import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Context } from 'telegraf';
import { CoreApiService } from '../../../core-api/core-api.service';
import { TelegramAuthUser } from '../../interfaces';
import { safeReply } from '../telegram-reply.util';
import { I18nService } from '../../../i18n';


@Injectable()
export class LocationHandler {
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
      await safeReply(ctx, tr.t('errorLoad'));
      return;
    }

    if (!telemetry) {
      await safeReply(ctx, tr.t('vehicleGone'));
      return;
    }

    await ctx.replyWithLocation(telemetry.latitude, telemetry.longitude);
    await ctx.reply(
      tr.t('mapLink', { plate: telemetry.licensePlate, url: telemetry.googleMapsUrl }),
      {
        reply_markup: {
          inline_keyboard: [[{ text: tr.t('btnBackVehicle'), callback_data: `veh:${vehicleId}` }]],
        },
      },
    );
  }
}
