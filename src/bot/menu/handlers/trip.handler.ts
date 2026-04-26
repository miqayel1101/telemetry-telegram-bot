import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Context } from 'telegraf';
import { CoreApiService } from '../../../core-api/core-api.service';
import { TelegramAuthUser } from '../../interfaces';
import { sendOrEdit, safeReply } from '../telegram-reply.util';

const ERROR_TEXT = 'Could not load data, please try again in a moment.';
const VEHICLE_GONE_TEXT = 'This vehicle is no longer available.';

@Injectable()
export class TripHandler {
  constructor(
    private readonly coreApiService: CoreApiService,
    private readonly logger: Logger,
  ) {}

  async handle(
    ctx: Context & { state: { user: TelegramAuthUser } },
    vehicleId: number,
  ): Promise<void> {
    const { coreUserId } = ctx.state.user;

    let trip;
    try {
      trip = await this.coreApiService.getTripToday(vehicleId, coreUserId);
    } catch (err: unknown) {
      this.logger.error({
        msg: 'telegram.menu.api-error',
        endpoint: '/api/internal/trips/today',
        coreUserId,
        error: err instanceof Error ? err.message : String(err),
      });
      await safeReply(ctx, ERROR_TEXT);
      return;
    }

    if (!trip) {
      await sendOrEdit(ctx, VEHICLE_GONE_TEXT, {
        inline_keyboard: [[{ text: 'Back to vehicle', callback_data: `veh:${vehicleId}` }]],
      }, this.logger);
      return;
    }

    const drivingMin = Math.round(trip.drivingTimeSeconds / 60);
    const lines = [
      `Today's trip summary:`,
      `Distance: ${trip.distanceKm.toFixed(1)} km`,
      `Driving time: ${drivingMin} min`,
      `Stops: ${trip.stops}`,
    ];

    if (trip.startLocation) {
      lines.push(`Start: ${trip.startLocation.latitude.toFixed(4)}, ${trip.startLocation.longitude.toFixed(4)}`);
    }
    if (trip.endLocation) {
      lines.push(`Last position: ${trip.endLocation.latitude.toFixed(4)}, ${trip.endLocation.longitude.toFixed(4)}`);
    }

    await sendOrEdit(ctx, lines.join('\n'), {
      inline_keyboard: [
        [{ text: 'Show current location', callback_data: `loc:${vehicleId}` }],
        [{ text: 'Back to vehicle', callback_data: `veh:${vehicleId}` }],
      ],
    }, this.logger);
  }
}
