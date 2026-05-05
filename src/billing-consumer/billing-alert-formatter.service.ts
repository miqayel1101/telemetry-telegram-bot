import { Injectable } from '@nestjs/common';
import { FormattedAlert } from '../geofence-consumer/interfaces';
import { IBillingStreamEvent } from './interfaces';

@Injectable()
export class BillingAlertFormatterService {
  format(event: IBillingStreamEvent): FormattedAlert {
    const text = this.buildText(event);

    return { text, parseMode: 'HTML', inlineKeyboard: [] };
  }

  private buildText(event: IBillingStreamEvent): string {
    const amount = `${event.amount.toLocaleString('en-US')} ${this.escapeHtml(event.currency)}`;

    switch (event.type) {
      case 'overdue':
        return (
          `\u26a0\ufe0f <b>Payment Overdue</b>\n\n` +
          `\ud83d\udc64 <b>Driver:</b> ${this.escapeHtml(event.driverName)}\n` +
          `\ud83d\ude97 <b>Vehicle:</b> ${this.escapeHtml(event.vehiclePlate)}\n` +
          `\ud83d\udcb0 <b>Amount:</b> ${amount}\n` +
          `\ud83d\udcc5 <b>Date:</b> ${this.escapeHtml(event.timestamp.slice(0, 10))}`
        );

      case 'blocked':
        return (
          `\ud83d\udd12 <b>Vehicle Blocked</b>\n\n` +
          `\ud83d\ude97 ${this.escapeHtml(event.vehiclePlate)} (${this.escapeHtml(event.driverName)})\n` +
          `Reason: Payment overdue`
        );

      case 'unblocked':
        return (
          `\ud83d\udd13 <b>Vehicle Unblocked</b>\n\n` +
          `\ud83d\ude97 ${this.escapeHtml(event.vehiclePlate)} (${this.escapeHtml(event.driverName)})\n` +
          `Vehicle is now available`
        );

      case 'paid':
        return (
          `\u2705 <b>Payment Received</b>\n\n` +
          `\ud83d\udc64 ${this.escapeHtml(event.driverName)} \u2014 ${amount}\n` +
          `\ud83d\ude97 ${this.escapeHtml(event.vehiclePlate)} now available`
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
