import { Injectable } from '@nestjs/common';
import { FormattedAlert, IGeofenceStreamEvent } from './interfaces';
import { ITranslator } from '../i18n';

@Injectable()
export class AlertFormatterService {
  format(event: IGeofenceStreamEvent, tr: ITranslator): FormattedAlert {
    const arrow = event.eventType === 'ENTRY' ? '➡️' : '⬅️';
    const action = event.eventType === 'ENTRY' ? tr.t('geoEntered') : tr.t('geoExited');

    const vehicleLabel = event.vehicleLabel
      ? ` (${this.escapeHtml(event.vehicleLabel)})`
      : '';

    const driverLine = event.driverName
      ? `\n👤 <b>${tr.t('geoDriver')}:</b> ${this.escapeHtml(event.driverName)}`
      : '';

    const text =
      `${arrow} <b>${tr.t('geoTitle')}</b>\n` +
      `\n` +
      `🚗 <b>${tr.t('geoVehicle')}:</b> ${this.escapeHtml(event.vehiclePlate)}${vehicleLabel}\n` +
      `📍 <b>${tr.t('geoZone')}:</b> ${this.escapeHtml(event.geofenceName)}\n` +
      `🔔 <b>${tr.t('geoEvent')}:</b> ${action}` +
      driverLine +
      `\n⏰ <b>${tr.t('geoTime')}:</b> ${tr.dateTime(event.timestamp)}`;

    const inlineKeyboard = [
      [
        {
          text: tr.t('btnShowLocation'),
          callback_data: `loc:${event.vehicleId}`,
        },
      ],
    ];

    return { text, parseMode: 'HTML', inlineKeyboard };
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
