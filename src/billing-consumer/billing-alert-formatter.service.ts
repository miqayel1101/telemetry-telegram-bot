import { Injectable } from '@nestjs/common';
import { FormattedAlert } from '../geofence-consumer/interfaces';
import { IBillingStreamEvent } from './interfaces';
import { ITranslator } from '../i18n';

@Injectable()
export class BillingAlertFormatterService {
  format(event: IBillingStreamEvent, tr: ITranslator): FormattedAlert {
    return { text: this.buildText(event, tr), parseMode: 'HTML', inlineKeyboard: [] };
  }

  private buildText(event: IBillingStreamEvent, tr: ITranslator): string {
    const amount = `${tr.number(event.amount)} ${this.escapeHtml(event.currency)}`;
    const plate = this.escapeHtml(event.vehiclePlate);
    const driver = this.escapeHtml(event.driverName);

    switch (event.type) {
      case 'overdue':
        return (
          `\u26a0\ufe0f <b>${tr.t('billOverdueTitle')}</b>\n\n` +
          `\ud83d\udc64 <b>${tr.t('billDriver')}:</b> ${driver}\n` +
          `\ud83d\ude97 <b>${tr.t('billVehicle')}:</b> ${plate}\n` +
          `\ud83d\udcb0 <b>${tr.t('billAmount')}:</b> ${amount}\n` +
          `\ud83d\udcc5 <b>${tr.t('billDate')}:</b> ${this.escapeHtml(event.timestamp.slice(0, 10))}`
        );

      case 'blocked':
        return (
          `\ud83d\udd12 <b>${tr.t('billBlockedTitle')}</b>\n\n` +
          `\ud83d\ude97 ${plate} (${driver})\n` +
          tr.t('billBlockedReason')
        );

      case 'unblocked':
        return (
          `\ud83d\udd13 <b>${tr.t('billUnblockedTitle')}</b>\n\n` +
          `\ud83d\ude97 ${plate} (${driver})\n` +
          tr.t('billUnblockedText')
        );

      case 'paid':
        return (
          `\u2705 <b>${tr.t('billPaidTitle')}</b>\n\n` +
          `\ud83d\udc64 ${driver} \u2014 ${amount}\n` +
          `\ud83d\ude97 ${tr.t('billPaidText', { plate })}`
        );
    }
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
