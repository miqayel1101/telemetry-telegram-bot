import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Context } from 'telegraf';
import { CoreApiService } from '../../../core-api/core-api.service';
import { MenuService } from '../menu.service';
import { TelegramAuthUser } from '../../interfaces';
import { safeReply } from '../telegram-reply.util';

const ERROR_TEXT = 'Could not load data, please try again in a moment.';

@Injectable()
export class FleetPickerHandler {
  constructor(
    private readonly coreApiService: CoreApiService,
    private readonly menuService: MenuService,
    private readonly logger: Logger,
  ) {}

  async handle(
    ctx: Context & { state: { user: TelegramAuthUser } },
    nextCallback: string,
  ): Promise<void> {
    const { coreUserId } = ctx.state.user;

    let response;
    try {
      response = await this.coreApiService.getVehicles(coreUserId, undefined, 0, 50);
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
      await safeReply(ctx, ERROR_TEXT);
      return;
    }

    // Build unique fleet IDs from vehicles
    const fleetIdSet = new Set<number>(response.data.map((v) => v.id));
    const fleets = [...fleetIdSet].map((id) => ({ id, name: `Fleet #${id}` }));

    const menu = this.menuService.buildFleetPicker(fleets);
    await ctx.reply(menu.text, { reply_markup: menu.reply_markup });
  }
}
