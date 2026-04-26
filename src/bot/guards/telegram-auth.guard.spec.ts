import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { Logger } from 'nestjs-pino';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { LinkingService } from '../../linking/linking.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

jest.mock('nestjs-telegraf', () => {
  const actual = jest.requireActual('nestjs-telegraf');
  return {
    ...actual,
    TelegrafExecutionContext: {
      create: jest.fn(),
    },
  };
});

const mockLogger = {
  debug: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockLinkingService = {
  getUserLinkStatus: jest.fn(),
};

function makeTgContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    from: { id: 12345 },
    chat: { type: 'private' },
    state: {},
    reply: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeExecutionContext(
  isPublic: boolean,
  tgCtx: Record<string, unknown>,
): ExecutionContext {
  const mockHandler = jest.fn();
  const mockClass = jest.fn();

  const execCtx = {
    getHandler: () => mockHandler,
    getClass: () => mockClass,
    getArgs: () => [tgCtx],
    getType: () => 'telegraf',
  } as unknown as ExecutionContext;

  const mockTgExecCtx = {
    getContext: () => tgCtx,
  };

  (TelegrafExecutionContext.create as jest.Mock).mockReturnValue(mockTgExecCtx);

  // isPublic flag is consumed via Reflector spy in each test
  void isPublic;

  return execCtx;
}

async function buildGuard(): Promise<{
  guard: TelegramAuthGuard;
  reflector: Reflector;
}> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TelegramAuthGuard,
      Reflector,
      { provide: Logger, useValue: mockLogger },
      { provide: LinkingService, useValue: mockLinkingService },
    ],
  }).compile();

  return {
    guard: module.get<TelegramAuthGuard>(TelegramAuthGuard),
    reflector: module.get<Reflector>(Reflector),
  };
}

describe('TelegramAuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('public handler', () => {
    it('returns true without DB lookup when handler is marked @Public()', async () => {
      const { guard, reflector } = await buildGuard();
      const tgCtx = makeTgContext();
      const execCtx = makeExecutionContext(true, tgCtx);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = await guard.canActivate(execCtx);

      expect(result).toBe(true);
      expect(mockLinkingService.getUserLinkStatus).not.toHaveBeenCalled();
    });
  });

  describe('linked user', () => {
    it('returns true and attaches user info to ctx.state when user is linked', async () => {
      const { guard, reflector } = await buildGuard();
      const tgCtx = makeTgContext({ from: { id: 99999 }, chat: { type: 'private' } });
      const execCtx = makeExecutionContext(false, tgCtx);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockLinkingService.getUserLinkStatus.mockResolvedValue({ linked: true, coreUserId: 42 });

      const result = await guard.canActivate(execCtx);

      expect(result).toBe(true);
      expect(mockLinkingService.getUserLinkStatus).toHaveBeenCalledWith(BigInt(99999));
      expect((tgCtx.state as Record<string, unknown>).user).toEqual({
        coreUserId: 42,
        telegramUserId: '99999',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'telegram.auth.granted', cacheHit: false }),
      );
    });
  });

  describe('unlinked user in private chat', () => {
    it('returns false and replies with connection instructions', async () => {
      const { guard, reflector } = await buildGuard();
      const replyMock = jest.fn().mockResolvedValue(undefined);
      const tgCtx = makeTgContext({
        from: { id: 55555 },
        chat: { type: 'private' },
        reply: replyMock,
      });
      const execCtx = makeExecutionContext(false, tgCtx);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockLinkingService.getUserLinkStatus.mockResolvedValue({ linked: false, coreUserId: null });

      const result = await guard.canActivate(execCtx);

      expect(result).toBe(false);
      expect(replyMock).toHaveBeenCalledWith(
        expect.stringContaining("You're not connected"),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'telegram.auth.denied', reason: 'not_linked' }),
      );
    });
  });

  describe('unlinked user in group chat', () => {
    it('returns false silently without replying', async () => {
      const { guard, reflector } = await buildGuard();
      const replyMock = jest.fn().mockResolvedValue(undefined);
      const tgCtx = makeTgContext({
        from: { id: 77777 },
        chat: { type: 'supergroup' },
        reply: replyMock,
      });
      const execCtx = makeExecutionContext(false, tgCtx);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockLinkingService.getUserLinkStatus.mockResolvedValue({ linked: false, coreUserId: null });

      const result = await guard.canActivate(execCtx);

      expect(result).toBe(false);
      expect(replyMock).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'telegram.auth.denied', chatType: 'supergroup' }),
      );
    });
  });

  describe('missing ctx.from (channel post / anonymous admin)', () => {
    it('returns false silently when ctx.from is undefined', async () => {
      const { guard, reflector } = await buildGuard();
      const replyMock = jest.fn().mockResolvedValue(undefined);
      const tgCtx = makeTgContext({
        from: undefined,
        chat: { type: 'channel' },
        reply: replyMock,
      });
      const execCtx = makeExecutionContext(false, tgCtx);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = await guard.canActivate(execCtx);

      expect(result).toBe(false);
      expect(replyMock).not.toHaveBeenCalled();
      expect(mockLinkingService.getUserLinkStatus).not.toHaveBeenCalled();
    });
  });

  describe('cache hit', () => {
    it('returns true on second request within TTL without hitting DB again', async () => {
      const { guard, reflector } = await buildGuard();

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockLinkingService.getUserLinkStatus.mockResolvedValue({ linked: true, coreUserId: 7 });

      // First call — populates cache
      const tgCtx1 = makeTgContext({ from: { id: 33333 }, chat: { type: 'private' } });
      const execCtx1 = makeExecutionContext(false, tgCtx1);
      const firstResult = await guard.canActivate(execCtx1);
      expect(firstResult).toBe(true);
      expect(mockLinkingService.getUserLinkStatus).toHaveBeenCalledTimes(1);

      // Second call — should use cache
      const tgCtx2 = makeTgContext({ from: { id: 33333 }, chat: { type: 'private' } });
      const execCtx2 = makeExecutionContext(false, tgCtx2);
      const secondResult = await guard.canActivate(execCtx2);
      expect(secondResult).toBe(true);
      expect(mockLinkingService.getUserLinkStatus).toHaveBeenCalledTimes(1); // no additional DB call

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'telegram.auth.granted', cacheHit: true }),
      );
    });
  });

  describe('DB error', () => {
    it('returns false and replies with error message in private chat when DB throws', async () => {
      const { guard, reflector } = await buildGuard();
      const replyMock = jest.fn().mockResolvedValue(undefined);
      const tgCtx = makeTgContext({
        from: { id: 11111 },
        chat: { type: 'private' },
        reply: replyMock,
      });
      const execCtx = makeExecutionContext(false, tgCtx);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockLinkingService.getUserLinkStatus.mockRejectedValue(new Error('Connection refused'));

      const result = await guard.canActivate(execCtx);

      expect(result).toBe(false);
      expect(replyMock).toHaveBeenCalledWith(
        expect.stringContaining('Something went wrong'),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'telegram.auth.db-error', telegramUserId: '11111' }),
      );
    });

    it('returns false silently in group chat when DB throws', async () => {
      const { guard, reflector } = await buildGuard();
      const replyMock = jest.fn().mockResolvedValue(undefined);
      const tgCtx = makeTgContext({
        from: { id: 22222 },
        chat: { type: 'group' },
        reply: replyMock,
      });
      const execCtx = makeExecutionContext(false, tgCtx);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockLinkingService.getUserLinkStatus.mockRejectedValue(new Error('Timeout'));

      const result = await guard.canActivate(execCtx);

      expect(result).toBe(false);
      expect(replyMock).not.toHaveBeenCalled();
    });
  });

  describe('IS_PUBLIC_KEY constant', () => {
    it('has the expected value', () => {
      expect(IS_PUBLIC_KEY).toBe('isPublic');
    });
  });
});
