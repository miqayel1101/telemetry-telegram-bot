import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Context } from 'telegraf';
import { CoreApiService } from '../../../core-api/core-api.service';
import { MenuService } from '../menu.service';
import { TelegramAuthUser } from '../../interfaces';
import { sendOrEdit, safeReply } from '../telegram-reply.util';
import { I18nService } from '../../../i18n';


@Injectable()
export class VehicleDetailHandler {
  constructor(
    private readonly coreApiService: CoreApiService,
    private readonly menuService: MenuService,
    private readonly logger: Logger,
    private readonly i18n: I18nService,
  ) {}

  async handle(
    ctx: Context & { state: { user: TelegramAuthUser } },
    vehicleId: number,
  ): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const tr = await this.i18n.forContext(ctx);
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
      await safeReply(ctx, tr.t('errorLoad'));
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
      await sendOrEdit(ctx, tr.t('vehicleGone'), {
        inline_keyboard: [[{ text: tr.t('btnBackVehicles'), callback_data: 'back:vehicles' }]],
      }, this.logger);
      return;
    }

    const ignitionState =
      telemetry.ignition === null
        ? tr.t('ignitionUnknown')
        : telemetry.ignition
          ? tr.t('ignitionOn')
          : tr.t('ignitionOff');
    const statusLine = [
      tr.t('speed', { speed: telemetry.speed }),
      tr.t('ignition', { state: ignitionState }),
      tr.t('lastUpdate', { time: tr.dateTime(telemetry.timestamp) }),
    ].join('\n');

    const card = this.menuService.buildVehicleCard(tr, {
      id: vehicleId,
      licensePlate: telemetry.licensePlate,
      statusLine,
    });

    await sendOrEdit(ctx, card.text, card.reply_markup, this.logger);
  }
}
