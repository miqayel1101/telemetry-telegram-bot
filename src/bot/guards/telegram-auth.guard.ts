import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Logger } from 'nestjs-pino';
import { LinkingService } from '../../linking/linking.service';
import { IS_PUBLIC_KEY } from '../decorators';
import { CacheEntry, TelegramAuthUser } from '../interfaces';
import { I18nService } from '../../i18n';

const CACHE_TTL_MS = 30_000;

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly reflector: Reflector,
    private readonly linkingService: LinkingService,
    private readonly logger: Logger,
    private readonly i18n: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const tgContext = TelegrafExecutionContext.create(context);
    const ctx = tgContext.getContext<Context & { state: Record<string, unknown> }>();

    if (!ctx.from) {
      this.logger.warn({
        msg: 'telegram.auth.denied',
        reason: 'no_sender',
        chatType: ctx.chat?.type ?? 'unknown',
      });
      return false;
    }

    const telegramUserId = ctx.from.id;
    const telegramUserIdStr = String(telegramUserId);
    const chatType = ctx.chat?.type ?? 'unknown';
    const isPrivateChat = chatType === 'private';

    const cached = this.cache.get(telegramUserIdStr);
    if (cached && cached.expiresAt > Date.now()) {
      const user: TelegramAuthUser = { coreUserId: cached.coreUserId, telegramUserId: telegramUserIdStr };
      ctx.state.user = user;
      this.logger.debug({
        msg: 'telegram.auth.granted',
        telegramUserId: telegramUserIdStr,
        coreUserId: cached.coreUserId,
        cacheHit: true,
      });
      return true;
    }

    let linkStatus: { linked: boolean; coreUserId: number | null };

    try {
      linkStatus = await this.linkingService.getUserLinkStatus(BigInt(telegramUserId));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({
        msg: 'telegram.auth.db-error',
        telegramUserId: telegramUserIdStr,
        error: message,
      });
      if (isPrivateChat) {
        const tr = await this.i18n.forContext(ctx);
        await ctx.reply(tr.t('somethingWrong'));
      }
      return false;
    }

    if (!linkStatus.linked || linkStatus.coreUserId === null) {
      this.logger.warn({
        msg: 'telegram.auth.denied',
        telegramUserId: telegramUserIdStr,
        chatType,
        reason: 'not_linked',
      });
      const tr = await this.i18n.forContext(ctx);
      if (ctx.callbackQuery) {
        // A button tapped (e.g. under a group alert) must get an answer, or it spins forever.
        await ctx.answerCbQuery(tr.t('notLinkedShort'), { show_alert: true }).catch(() => undefined);
      } else if (isPrivateChat) {
        await ctx.reply(tr.t('notLinked'));
      }
      return false;
    }

    this.cache.set(telegramUserIdStr, {
      coreUserId: linkStatus.coreUserId,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    const user: TelegramAuthUser = { coreUserId: linkStatus.coreUserId, telegramUserId: telegramUserIdStr };
    ctx.state.user = user;

    this.logger.debug({
      msg: 'telegram.auth.granted',
      telegramUserId: telegramUserIdStr,
      coreUserId: linkStatus.coreUserId,
      cacheHit: false,
    });

    return true;
  }
}
