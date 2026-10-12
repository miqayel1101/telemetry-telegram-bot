import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Context } from 'telegraf';
import { CoreApiService } from '../../../core-api/core-api.service';
import { TelegramAuthUser } from '../../interfaces';
import { sendOrEdit, safeReply } from '../telegram-reply.util';
import { I18nService } from '../../../i18n';


@Injectable()
export class TripHandler {
  constructor(
    private readonly coreApiService: CoreApiService,
    private readonly logger: Logger,
    private readonly i18n: I18nService,
  ) {}

  async handle(
    ctx: Context & { state: { user: TelegramAuthUser } },
    vehicleId: number,
  ): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const tr = await this.i18n.forContext(ctx);

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
      await safeReply(ctx, tr.t('errorLoad'));
      return;
    }

    if (!trip) {
      await sendOrEdit(ctx, tr.t('vehicleGone'), {
        inline_keyboard: [[{ text: tr.t('btnBackVehicle'), callback_data: `veh:${vehicleId}` }]],
      }, this.logger);
      return;
    }

    const drivingMin = Math.round(trip.drivingTimeSeconds / 60);
    const lines = [
      tr.t('tripTitle'),
      tr.t('tripDistance', { km: trip.distanceKm.toFixed(1) }),
      tr.t('tripDriving', { min: drivingMin }),
      tr.t('tripStops', { count: trip.stops }),
    ];

    if (trip.startLocation) {
      lines.push(
        tr.t('tripStart', {
          coords: `${trip.startLocation.latitude.toFixed(4)}, ${trip.startLocation.longitude.toFixed(4)}`,
        }),
      );
    }
    if (trip.endLocation) {
      lines.push(
        tr.t('tripLast', {
          coords: `${trip.endLocation.latitude.toFixed(4)}, ${trip.endLocation.longitude.toFixed(4)}`,
        }),
      );
    }

    await sendOrEdit(ctx, lines.join('\n'), {
      inline_keyboard: [
        [{ text: tr.t('btnShowMap'), callback_data: `loc:${vehicleId}` }],
        [{ text: tr.t('btnBackVehicle'), callback_data: `veh:${vehicleId}` }],
      ],
    }, this.logger);
  }
}
