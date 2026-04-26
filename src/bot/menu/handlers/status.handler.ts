import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Context } from 'telegraf';
import { CoreApiService } from '../../../core-api/core-api.service';
import { MenuCacheService } from '../menu-cache.service';
import { MenuService } from '../menu.service';
import { TelegramAuthUser } from '../../interfaces';
import { sendOrEdit, safeReply } from '../telegram-reply.util';

const ERROR_TEXT = 'Could not load data, please try again in a moment.';

@Injectable()
export class StatusHandler {
  constructor(
    private readonly coreApiService: CoreApiService,
    private readonly menuCacheService: MenuCacheService,
    private readonly menuService: MenuService,
    private readonly logger: Logger,
  ) {}

  async handle(
    ctx: Context & { state: { user: TelegramAuthUser } },
    fleetId: number | undefined,
  ): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const start = Date.now();

    let status = this.menuCacheService.getStatus<Awaited<ReturnType<CoreApiService['getFleetStatus']>>>(
      coreUserId,
      fleetId,
    );

    if (!status) {
      try {
        status = await this.coreApiService.getFleetStatus(coreUserId, fleetId);
      } catch (err: unknown) {
        this.logger.error({
          msg: 'telegram.menu.api-error',
          endpoint: '/api/internal/fleets/status',
          coreUserId,
          error: err instanceof Error ? err.message : String(err),
        });
        await safeReply(ctx, ERROR_TEXT);
        return;
      }

      if (!status) {
        this.logger.error({
          msg: 'telegram.menu.api-error',
          endpoint: '/api/internal/fleets/status',
          coreUserId,
          statusCode: 0,
        });
        await safeReply(ctx, ERROR_TEXT);
        return;
      }

      this.menuCacheService.setStatus(coreUserId, fleetId, status);
    }

    this.logger.log({
      msg: 'telegram.menu.callback',
      callbackPrefix: 'menu:status',
      coreUserId,
      chatType: ctx.chat?.type,
      latencyMs: Date.now() - start,
    });

    const menu = this.menuService.buildFleetStatus(status);
    await sendOrEdit(ctx, menu.text, menu.reply_markup, this.logger);
  }
}
