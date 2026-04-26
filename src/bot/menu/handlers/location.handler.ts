import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Context } from 'telegraf';
import { CoreApiService } from '../../../core-api/core-api.service';
import { TelegramAuthUser } from '../../interfaces';
import { safeReply } from '../telegram-reply.util';

const ERROR_TEXT = 'Could not load data, please try again in a moment.';
const VEHICLE_GONE_TEXT = 'This vehicle is no longer available.';

@Injectable()
export class LocationHandler {
  constructor(
    private readonly coreApiService: CoreApiService,
    private readonly logger: Logger,
  ) {}

  async handle(
    ctx: Context & { state: { user: TelegramAuthUser } },
    vehicleId: number,
  ): Promise<void> {
    const { coreUserId } = ctx.state.user;

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

    if (!telemetry) {
      await safeReply(ctx, VEHICLE_GONE_TEXT);
      return;
    }

    await ctx.replyWithLocation(telemetry.latitude, telemetry.longitude);
    await ctx.reply(
      `${telemetry.licensePlate} — Google Maps: ${telemetry.googleMapsUrl}`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: 'Back to vehicle', callback_data: `veh:${vehicleId}` }]],
        },
      },
    );
  }
}
