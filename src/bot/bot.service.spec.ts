import { Test, TestingModule } from '@nestjs/testing';
import { BotService } from './bot.service';
import { LinkingService } from '../linking/linking.service';
import { Logger } from 'nestjs-pino';

const mockLinkingService = {
  getUserLinkStatus: jest.fn(),
  redeemUserToken: jest.fn(),
  redeemGroupToken: jest.fn(),
};

function makeCtx(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    from: { id: 12345, username: 'testuser' },
    chat: { id: 12345, type: 'private' },
    botInfo: { id: 999 },
    message: { text: '/start' },
    reply: jest.fn().mockResolvedValue(undefined),
    telegram: {
      getChatMember: jest.fn().mockResolvedValue({ status: 'administrator' }),
    },
    ...overrides,
  };
}

describe('BotService', () => {
  let service: BotService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: Logger, useValue: { debug: jest.fn(), log: jest.fn(), warn: jest.fn() } },
        { provide: LinkingService, useValue: mockLinkingService },
      ],
    }).compile();

    service = module.get<BotService>(BotService);
  });

  it('handlePing returns "pong"', () => {
    const result = service.handlePing(123, 456);
    expect(result).toBe('pong');
  });

  it('handlePing returns a string for any numeric inputs', () => {
    expect(typeof service.handlePing(0, 0)).toBe('string');
  });

  describe('handleStart()', () => {
    it('with token → success (linked status)', async () => {
      mockLinkingService.redeemUserToken.mockResolvedValue({
        status: 'ok',
        coreUserId: 42,
        firstName: 'Alice',
        lastName: 'Smith',
      });
      const ctx = makeCtx({ message: { text: '/start abc123token' } });

      await service.handleStart(ctx as never);

      expect(mockLinkingService.redeemUserToken).toHaveBeenCalledWith(
        'abc123token',
        BigInt(12345),
        'testuser',
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Successfully linked'),
      );
    });

    it('with token → expired', async () => {
      mockLinkingService.redeemUserToken.mockResolvedValue({ status: 'expired' });
      const ctx = makeCtx({ message: { text: '/start expiredtoken' } });

      await service.handleStart(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('expired'),
      );
    });

    it('with token → already_used', async () => {
      mockLinkingService.redeemUserToken.mockResolvedValue({ status: 'already_used' });
      const ctx = makeCtx({ message: { text: '/start usedtoken' } });

      await service.handleStart(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('already been used'),
      );
    });

    it('with token → not_found replies with "Invalid link"', async () => {
      mockLinkingService.redeemUserToken.mockResolvedValue({ status: 'not_found' });
      const ctx = makeCtx({ message: { text: '/start unknowntoken' } });

      await service.handleStart(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Invalid link'),
      );
    });

    it('with token → wrong_purpose replies with "Invalid link"', async () => {
      mockLinkingService.redeemUserToken.mockResolvedValue({ status: 'wrong_purpose' });
      const ctx = makeCtx({ message: { text: '/start wrongtoken' } });

      await service.handleStart(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Invalid link'),
      );
    });

    it('without token → user linked', async () => {
      mockLinkingService.getUserLinkStatus.mockResolvedValue({ linked: true, coreUserId: 7 });
      const ctx = makeCtx({ message: { text: '/start' } });

      await service.handleStart(ctx as never);

      expect(mockLinkingService.getUserLinkStatus).toHaveBeenCalledWith(BigInt(12345));
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('currently linked'),
      );
    });

    it('without token → user not linked', async () => {
      mockLinkingService.getUserLinkStatus.mockResolvedValue({ linked: false, coreUserId: null });
      const ctx = makeCtx({ message: { text: '/start' } });

      await service.handleStart(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Generate Link'),
      );
    });
  });

  describe('handleConnectGroup()', () => {
    it('success → replies with fleet name', async () => {
      mockLinkingService.redeemGroupToken.mockResolvedValue({
        status: 'ok',
        fleetId: 5,
        coreUserId: 10,
        fleetName: 'Fleet Alpha',
        companyName: 'Acme Corp',
      });
      const ctx = makeCtx({
        chat: { id: -1001234567890, type: 'supergroup', title: 'My Fleet Group' },
        message: { text: '/connect_group grouptoken' },
      });

      await service.handleConnectGroup(ctx as never);

      expect(mockLinkingService.redeemGroupToken).toHaveBeenCalledWith(
        'grouptoken',
        BigInt(-1001234567890),
        'My Fleet Group',
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Fleet Alpha'),
      );
    });

    it('in private chat → rejected before token is checked', async () => {
      const ctx = makeCtx({
        chat: { id: 12345, type: 'private' },
        message: { text: '/connect_group grouptoken' },
      });

      await service.handleConnectGroup(ctx as never);

      expect(mockLinkingService.redeemGroupToken).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('only be used in a group chat'),
      );
    });

    it('without token → replies with usage instructions', async () => {
      const ctx = makeCtx({
        chat: { id: -1001234567890, type: 'supergroup', title: 'My Fleet Group' },
        message: { text: '/connect_group' },
      });

      await service.handleConnectGroup(ctx as never);

      expect(mockLinkingService.redeemGroupToken).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Usage:'),
      );
    });

    it('bot not admin → replies with admin instruction, token not consumed', async () => {
      const groupCtx = makeCtx({
        chat: { id: -100987, type: 'supergroup', title: 'SomeGroup' },
        message: { text: '/connect_group grouptoken' },
        telegram: {
          getChatMember: jest.fn().mockResolvedValue({ status: 'member' }),
        },
      });

      await service.handleConnectGroup(groupCtx as never);

      expect(mockLinkingService.redeemGroupToken).not.toHaveBeenCalled();
      expect(groupCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Please make me an admin'),
      );
    });

    it('expired token → replies with expired message', async () => {
      mockLinkingService.redeemGroupToken.mockResolvedValue({ status: 'expired' });
      const ctx = makeCtx({
        chat: { id: -1001234567890, type: 'supergroup', title: 'My Fleet Group' },
        message: { text: '/connect_group expiredtoken' },
      });

      await service.handleConnectGroup(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('expired'),
      );
    });

    it('already_used token → replies with already used message', async () => {
      mockLinkingService.redeemGroupToken.mockResolvedValue({ status: 'already_used' });
      const ctx = makeCtx({
        chat: { id: -1001234567890, type: 'supergroup', title: 'My Fleet Group' },
        message: { text: '/connect_group usedtoken' },
      });

      await service.handleConnectGroup(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('already been used'),
      );
    });

    it('not_found token → replies with "Invalid link"', async () => {
      mockLinkingService.redeemGroupToken.mockResolvedValue({ status: 'not_found' });
      const ctx = makeCtx({
        chat: { id: -1001234567890, type: 'supergroup', title: 'My Fleet Group' },
        message: { text: '/connect_group unknowntoken' },
      });

      await service.handleConnectGroup(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Invalid link'),
      );
    });

    it('wrong_purpose token → replies with wrong purpose message', async () => {
      mockLinkingService.redeemGroupToken.mockResolvedValue({ status: 'wrong_purpose' });
      const ctx = makeCtx({
        chat: { id: -1001234567890, type: 'supergroup', title: 'My Fleet Group' },
        message: { text: '/connect_group wrongtoken' },
      });

      await service.handleConnectGroup(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('not valid for group linking'),
      );
    });

    it('no_fleet token → replies with no fleet message', async () => {
      mockLinkingService.redeemGroupToken.mockResolvedValue({ status: 'no_fleet' });
      const ctx = makeCtx({
        chat: { id: -1001234567890, type: 'supergroup', title: 'My Fleet Group' },
        message: { text: '/connect_group nofleettoken' },
      });

      await service.handleConnectGroup(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('no fleet associated'),
      );
    });
  });
});
