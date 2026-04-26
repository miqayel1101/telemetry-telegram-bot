import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Context } from 'telegraf';
import { CoreApiService } from '../../../core-api/core-api.service';
import { MenuService } from '../menu.service';
import { TelegramAuthUser } from '../../interfaces';
import { sendOrEdit, safeReply } from '../telegram-reply.util';

const ERROR_TEXT = 'Could not load data, please try again in a moment.';
const VEHICLE_GONE_TEXT = 'This vehicle is no longer available.';

@Injectable()
export class VehicleDetailHandler {
  constructor(
    private readonly coreApiService: CoreApiService,
    private readonly menuService: MenuService,
    private readonly logger: Logger,
  ) {}

  async handle(
    ctx: Context & { state: { user: TelegramAuthUser } },
    vehicleId: number,
  ): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const start = Date.now();

    let telemetry;
    try {
      telemetry = await this.coreApiService.getVehicleTelemetry(vehicleId, coreUserId);
    } catch (err: unknown) {
      this.logger.error({
        msg: 'telegram.menu.api-error',
        endpoint: `/api/internal/vehicles/${vehicleId}/telemetry`,
        coreUserId,
        error: err instanceof Error ? err.message : String(err),
      });
      await safeReply(ctx, ERROR_TEXT);
      return;
    }

    this.logger.log({
      msg: 'telegram.menu.callback',
      callbackPrefix: 'veh',
      coreUserId,
      chatType: ctx.chat?.type,
      latencyMs: Date.now() - start,
    });

    if (!telemetry) {
      await sendOrEdit(ctx, VEHICLE_GONE_TEXT, {
        inline_keyboard: [[{ text: 'Back to vehicles', callback_data: 'back:vehicles' }]],
      }, this.logger);
      return;
    }

    const ignitionStr =
      telemetry.ignition === null ? 'Unknown' : telemetry.ignition ? 'On' : 'Off';
    const statusLine = [
      `Speed: ${telemetry.speed} km/h`,
      `Ignition: ${ignitionStr}`,
      `Last update: ${new Date(telemetry.timestamp).toLocaleString()}`,
    ].join('\n');

    const card = this.menuService.buildVehicleCard(
      vehicleId,
      telemetry.licensePlate,
      statusLine,
    );

    await sendOrEdit(ctx, card.text, card.reply_markup, this.logger);
  }
}
