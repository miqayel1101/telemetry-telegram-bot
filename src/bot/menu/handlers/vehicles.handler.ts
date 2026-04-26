import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Context } from 'telegraf';
import { CoreApiService } from '../../../core-api/core-api.service';
import { MenuCacheService } from '../menu-cache.service';
import { MenuService } from '../menu.service';
import { TelegramAuthUser } from '../../interfaces';
import { sendOrEdit, safeReply } from '../telegram-reply.util';

const PAGE_SIZE = 8;
const ERROR_TEXT = 'Could not load data, please try again in a moment.';

@Injectable()
export class VehiclesHandler {
  constructor(
    private readonly coreApiService: CoreApiService,
    private readonly menuCacheService: MenuCacheService,
    private readonly menuService: MenuService,
    private readonly logger: Logger,
  ) {}

  async handle(
    ctx: Context & { state: { user: TelegramAuthUser } },
    fleetId: number | undefined,
    offset = 0,
  ): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const page = Math.floor(offset / PAGE_SIZE);

    let response = this.menuCacheService.getVehicleList<Awaited<ReturnType<CoreApiService['getVehicles']>>>(
      coreUserId,
      fleetId,
    );

    if (!response) {
      try {
        response = await this.coreApiService.getVehicles(coreUserId, fleetId, page, PAGE_SIZE);
      } catch (err: unknown) {
        this.logger.error({
          msg: 'telegram.menu.api-error',
          endpoint: '/api/internal/vehicles',
          coreUserId,
          error: err instanceof Error ? err.message : String(err),
        });
        await safeReply(ctx, ERROR_TEXT);
        return;
      }

      if (!response) {
        this.logger.error({
          msg: 'telegram.menu.api-error',
          endpoint: '/api/internal/vehicles',
          coreUserId,
          statusCode: 0,
        });
        await safeReply(ctx, ERROR_TEXT);
        return;
      }

      this.menuCacheService.setVehicleList(coreUserId, fleetId, response);
    }

    const clampedOffset = Math.min(offset, Math.max(0, response.total - PAGE_SIZE));
    const clampedPage = Math.floor(clampedOffset / PAGE_SIZE);
    const wasClampedNote = offset > 0 && clampedOffset !== offset ? ' (showing from start)' : '';

    let displayResponse = response;
    if (clampedPage !== page) {
      const fresh = await this.coreApiService.getVehicles(coreUserId, fleetId, clampedPage, PAGE_SIZE);
      if (fresh) {
        displayResponse = fresh;
        this.menuCacheService.setVehicleList(coreUserId, fleetId, fresh);
      }
    }

    const menu = this.menuService.buildVehicleList(
      displayResponse.data,
      displayResponse.total,
      clampedPage,
      PAGE_SIZE,
    );

    if (wasClampedNote) {
      menu.text = menu.text + wasClampedNote;
    }

    await sendOrEdit(ctx, menu.text, menu.reply_markup, this.logger);
  }
}
