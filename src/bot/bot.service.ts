import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Context, Telegraf } from 'telegraf';
import { InjectBot } from 'nestjs-telegraf';
import { LinkingService } from '../linking/linking.service';
import { RedeemGroupTokenResult } from '../linking/interfaces';
import { CoreApiService } from '../core-api/core-api.service';
import { I18nService, ITranslator, LANGUAGE_LABELS, LanguageEnum } from '../i18n';

const ADMIN_STATUSES = ['administrator', 'creator'];

@Injectable()
export class BotService implements OnApplicationBootstrap {
  constructor(
    private readonly logger: Logger,
    private readonly linkingService: LinkingService,
    private readonly coreApiService: CoreApiService,
    private readonly i18n: I18nService,
    @InjectBot() private readonly bot: Telegraf,
  ) {}

  // The "/" command list in Telegram, in each language (Armenian by default).
  async onApplicationBootstrap(): Promise<void> {
    for (const language of Object.values(LanguageEnum)) {
      const tr = this.i18n.translator(language);
      const commands = [
        { command: 'menu', description: tr.t('cmdMenu') },
        { command: 'vehicles', description: tr.t('cmdVehicles') },
        { command: 'status', description: tr.t('cmdStatus') },
        { command: 'where', description: tr.t('cmdWhere') },
        { command: 'today', description: tr.t('cmdToday') },
        { command: 'language', description: tr.t('cmdLanguage') },
        { command: 'help', description: tr.t('cmdHelp') },
      ];
      try {
        await this.bot.telegram.setMyCommands(
          commands,
          language === LanguageEnum.HY ? undefined : { language_code: language },
        );
      } catch (err: unknown) {
        this.logger.warn({
          msg: 'bot.commands.register-failed',
          language,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  handlePing(chatId: number, userId: number): string {
    this.logger.debug({ msg: 'bot.command.ping', chatId, userId });
    return 'pong';
  }

  async handleStart(ctx: Context): Promise<void> {
    const rawToken = this.commandToken(ctx);

    // "Add to group" links (t.me/<bot>?startgroup=<token>) arrive as /start in the group.
    if (rawToken && this.isGroup(ctx)) {
      await this.connectGroup(ctx, rawToken);
      return;
    }

    const tr = await this.i18n.forContext(ctx);
    const telegramUserId = BigInt(ctx.from?.id ?? 0);
    const telegramUsername = ctx.from?.username ?? null;

    if (!rawToken) {
      const status = await this.linkingService.getUserLinkStatus(telegramUserId);
      if (status.linked && status.coreUserId !== null) {
        const user = await this.coreApiService.getUserDisplayName(status.coreUserId);
        const name = user ? `${user.firstName} ${user.lastName}` : `#${status.coreUserId}`;
        await ctx.reply(tr.t('startLinked', { name }));
      } else {
        await ctx.reply(tr.t('startWelcome'));
      }
      return;
    }

    const result = await this.linkingService.redeemUserToken(
      rawToken,
      telegramUserId,
      telegramUsername,
    );

    switch (result.status) {
      case 'ok':
        await ctx.reply(
          result.firstName ? tr.t('linkOkNamed', { name: result.firstName }) : tr.t('linkOk'),
        );
        break;
      case 'expired':
        await ctx.reply(tr.t('linkExpired'));
        break;
      case 'already_used':
        await ctx.reply(tr.t('linkUsed'));
        break;
      case 'not_found':
      case 'wrong_purpose':
        await ctx.reply(tr.t('linkInvalid'));
        break;
    }
  }

  async handleConnectGroup(ctx: Context): Promise<void> {
    const tr = await this.i18n.forContext(ctx);
    if (!this.isGroup(ctx)) {
      await ctx.reply(tr.t('groupOnly'));
      return;
    }

    const rawToken = this.commandToken(ctx);
    if (!rawToken) {
      await ctx.reply(tr.t('groupUsage'));
      return;
    }

    await this.connectGroup(ctx, rawToken);
  }

  async handleLanguagePrompt(ctx: Context): Promise<void> {
    const tr = await this.i18n.forContext(ctx);
    await ctx.reply(tr.t('languagePrompt'), {
      reply_markup: {
        inline_keyboard: [
          Object.values(LanguageEnum).map((language) => ({
            text: `${language === tr.language ? '✓ ' : ''}${LANGUAGE_LABELS[language]}`,
            callback_data: `lang:${language}`,
          })),
        ],
      },
    });
  }

  async handleLanguageChosen(ctx: Context): Promise<void> {
    const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
    const language = Object.values(LanguageEnum).find((l) => data === `lang:${l}`);
    const chatId = ctx.chat?.id;
    if (!language || chatId === undefined) {
      await ctx.answerCbQuery();
      return;
    }

    // In a group the language is everyone's, so only its admins choose it.
    if (this.isGroup(ctx) && !(await this.isChatAdmin(ctx, ctx.from?.id))) {
      const tr = await this.i18n.forContext(ctx);
      await ctx.answerCbQuery(tr.t('languageAdminsOnly'), { show_alert: true });
      return;
    }

    await this.i18n.setChatLanguage(String(chatId), language);
    const tr = this.i18n.translator(language);
    await ctx.answerCbQuery();
    try {
      await ctx.editMessageText(`✓ ${tr.t('languageSet')}`);
    } catch {
      await ctx.reply(`✓ ${tr.t('languageSet')}`);
    }
    this.logger.log({ msg: 'bot.language.set', chatId, language });
  }

  private async connectGroup(ctx: Context, rawToken: string): Promise<void> {
    const chat = ctx.chat;
    const tr = await this.i18n.forContext(ctx);
    if (!chat || chat.type === 'private') {
      await ctx.reply(tr.t('groupOnly'));
      return;
    }

    if (ctx.botInfo?.id && !(await this.isChatAdmin(ctx, ctx.botInfo.id))) {
      await ctx.reply(tr.t('groupNeedAdmin'));
      return;
    }

    const result = await this.linkingService.redeemGroupToken(
      rawToken,
      BigInt(chat.id),
      'title' in chat ? chat.title : null,
    );

    await ctx.reply(this.groupResultText(tr, result));
  }

  private groupResultText(tr: ITranslator, result: RedeemGroupTokenResult): string {
    switch (result.status) {
      case 'ok':
        return result.fleetName
          ? tr.t('groupOkNamed', {
              fleet: result.fleetName,
              company: result.companyName ?? '',
            })
          : tr.t('groupOk');
      case 'expired':
        return tr.t('linkExpired');
      case 'already_used':
        return tr.t('linkUsed');
      case 'wrong_purpose':
        return tr.t('groupWrongPurpose');
      case 'no_fleet':
        return tr.t('groupNoFleet');
      default:
        return tr.t('linkInvalid');
    }
  }

  private async isChatAdmin(ctx: Context, userId: number | undefined): Promise<boolean> {
    if (!ctx.chat || userId === undefined) return false;
    try {
      const member = await ctx.telegram.getChatMember(ctx.chat.id, userId);
      return ADMIN_STATUSES.includes(member.status);
    } catch {
      return false;
    }
  }

  private isGroup(ctx: Context): boolean {
    return ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  }

  /** The first argument of a command: "/start abc" or "/start@bot abc" → "abc". */
  private commandToken(ctx: Context): string | null {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.trim().split(/\s+/);
    return parts.length > 1 ? parts[1] : null;
  }
}
