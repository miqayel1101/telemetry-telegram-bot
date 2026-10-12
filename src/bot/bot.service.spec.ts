import { Test, TestingModule } from '@nestjs/testing';
import { BotService } from './bot.service';
import { LinkingService } from '../linking/linking.service';
import { Logger } from 'nestjs-pino';
import { getBotToken } from 'nestjs-telegraf';
import { I18nService, LanguageEnum } from '../i18n';
import { createTestI18nService } from '../i18n/i18n.testing';
import { CoreApiService } from '../core-api/core-api.service';

// Chats with no stored language and no Russian Telegram get Armenian.
const hy = createTestI18nService().translator(LanguageEnum.HY);

const mockCoreApiService = {
  getUserDisplayName: jest.fn(),
};

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
        { provide: I18nService, useValue: createTestI18nService() },
        { provide: LinkingService, useValue: mockLinkingService },
        { provide: CoreApiService, useValue: mockCoreApiService },
        { provide: getBotToken(), useValue: { telegram: { setMyCommands: jest.fn() } } },
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
        hy.t('linkOkNamed', { name: 'Alice' }),
      );
    });

    it('with token → expired', async () => {
      mockLinkingService.redeemUserToken.mockResolvedValue({ status: 'expired' });
      const ctx = makeCtx({ message: { text: '/start expiredtoken' } });

      await service.handleStart(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        hy.t('linkExpired'),
      );
    });

    it('with token → already_used', async () => {
      mockLinkingService.redeemUserToken.mockResolvedValue({ status: 'already_used' });
      const ctx = makeCtx({ message: { text: '/start usedtoken' } });

      await service.handleStart(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        hy.t('linkUsed'),
      );
    });

    it('with token → not_found replies with "Invalid link"', async () => {
      mockLinkingService.redeemUserToken.mockResolvedValue({ status: 'not_found' });
      const ctx = makeCtx({ message: { text: '/start unknowntoken' } });

      await service.handleStart(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        hy.t('linkInvalid'),
      );
    });

    it('with token → wrong_purpose replies with "Invalid link"', async () => {
      mockLinkingService.redeemUserToken.mockResolvedValue({ status: 'wrong_purpose' });
      const ctx = makeCtx({ message: { text: '/start wrongtoken' } });

      await service.handleStart(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        hy.t('linkInvalid'),
      );
    });

    it('without token → user linked', async () => {
      mockLinkingService.getUserLinkStatus.mockResolvedValue({ linked: true, coreUserId: 7 });
      mockCoreApiService.getUserDisplayName.mockResolvedValue({
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
      });
      const ctx = makeCtx({ message: { text: '/start' } });

      await service.handleStart(ctx as never);

      expect(mockLinkingService.getUserLinkStatus).toHaveBeenCalledWith(BigInt(12345));
      expect(ctx.reply).toHaveBeenCalledWith(
        hy.t('startLinked', { name: 'Alice Smith' }),
      );
    });

    it('without token → user not linked', async () => {
      mockLinkingService.getUserLinkStatus.mockResolvedValue({ linked: false, coreUserId: null });
      const ctx = makeCtx({ message: { text: '/start' } });

      await service.handleStart(ctx as never);

      expect(ctx.reply).toHaveBeenCalledWith(
        hy.t('startWelcome'),
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
        hy.t('groupOnly'),
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
        hy.t('groupUsage'),
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
        hy.t('groupNeedAdmin'),
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
        hy.t('linkExpired'),
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
        hy.t('linkUsed'),
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
        hy.t('linkInvalid'),
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
        hy.t('groupWrongPurpose'),
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
        hy.t('groupNoFleet'),
      );
    });
  });

  describe('group links and language', () => {
    it('/start with a token inside a group links the group (one-tap "add to group" link)', async () => {
      mockLinkingService.redeemGroupToken.mockResolvedValue({
        status: 'ok',
        fleetId: 3,
        coreUserId: 1,
        fleetName: 'Fleet Alpha',
        companyName: 'Acme',
      });
      const ctx = makeCtx({
        chat: { id: -100555, type: 'supergroup', title: 'Dispatch' },
        message: { text: '/start@telemetry_bot grouptoken' },
      });

      await service.handleStart(ctx as never);

      expect(mockLinkingService.redeemUserToken).not.toHaveBeenCalled();
      expect(mockLinkingService.redeemGroupToken).toHaveBeenCalledWith(
        'grouptoken',
        BigInt(-100555),
        'Dispatch',
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        hy.t('groupOkNamed', { fleet: 'Fleet Alpha', company: 'Acme' }),
      );
    });

    it('offers the three languages, marking the current one', async () => {
      const ctx = makeCtx();

      await service.handleLanguagePrompt(ctx as never);

      const [text, extra] = (ctx.reply as jest.Mock).mock.calls[0];
      expect(text).toBe(hy.t('languagePrompt'));
      const buttons = extra.reply_markup.inline_keyboard[0];
      expect(buttons.map((b: { callback_data: string }) => b.callback_data)).toEqual([
        'lang:hy',
        'lang:ru',
        'lang:en',
      ]);
      expect(buttons[0].text).toBe('✓ Հայերեն');
    });

    it('lets only group admins change a group language', async () => {
      const ctx = makeCtx({
        chat: { id: -100555, type: 'group' },
        callbackQuery: { data: 'lang:ru' },
        answerCbQuery: jest.fn().mockResolvedValue(undefined),
        editMessageText: jest.fn().mockResolvedValue(undefined),
        telegram: { getChatMember: jest.fn().mockResolvedValue({ status: 'member' }) },
      });

      await service.handleLanguageChosen(ctx as never);

      expect(ctx.answerCbQuery).toHaveBeenCalledWith(hy.t('languageAdminsOnly'), {
        show_alert: true,
      });
      expect(ctx.editMessageText).not.toHaveBeenCalled();
    });

    it('confirms the chosen language in that language', async () => {
      const ctx = makeCtx({
        callbackQuery: { data: 'lang:en' },
        answerCbQuery: jest.fn().mockResolvedValue(undefined),
        editMessageText: jest.fn().mockResolvedValue(undefined),
      });

      await service.handleLanguageChosen(ctx as never);

      expect(ctx.editMessageText).toHaveBeenCalledWith('✓ Language: English');
    });
  });
});
