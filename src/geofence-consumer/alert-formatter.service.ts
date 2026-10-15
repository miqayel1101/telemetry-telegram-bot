import { Injectable } from '@nestjs/common';
import { FormattedAlert, IGeofenceStreamEvent } from './interfaces';
import { ITranslator } from '../i18n';
import type { MessageKey } from '../i18n/messages';

@Injectable()
export class AlertFormatterService {
  format(event: IGeofenceStreamEvent, tr: ITranslator): FormattedAlert {
    if (event.eventType === 'SPEEDING' || event.eventType === 'OFFLINE' || event.eventType === 'MAINTENANCE') {
      return this.formatFleetAlert(event, tr);
    }
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

  /** Speeding, offline and maintenance: the same alerts the dashboard shows */
  private formatFleetAlert(event: IGeofenceStreamEvent, tr: ITranslator): FormattedAlert {
    const d = event.details ?? {};
    const vehicleLabel = event.vehicleLabel ? ` (${this.escapeHtml(event.vehicleLabel)})` : '';
    const driverLine = event.driverName
      ? `\n👤 <b>${tr.t('geoDriver')}:</b> ${this.escapeHtml(event.driverName)}`
      : '';
    let icon: string;
    let title: string;
    let line: string;

    if (event.eventType === 'SPEEDING') {
      icon = '🚨';
      title = tr.t('speedTitle');
      line =
        `🏎 <b>${tr.t('alertSpeed')}:</b> ` +
        tr.t('speedValue', { speed: Math.round(Number(d.speed ?? 0)), limit: d.limitKmh ?? '—' });
    } else if (event.eventType === 'OFFLINE') {
      icon = '📵';
      title = tr.t('offlineTitle');
      line =
        `🔔 <b>${tr.t('alertState')}:</b> ${tr.t('offlineValue', { minutes: d.offlineMinutes ?? '—' })}` +
        (d.lastSeenAt ? `\n🕓 <b>${tr.t('offlineLastSeen')}:</b> ${tr.dateTime(d.lastSeenAt)}` : '');
    } else {
      icon = '🔧';
      title = tr.t('maintTitle');
      const kindKey = `maint_${d.kind ?? 'CUSTOM'}` as MessageKey;
      const task = d.title || tr.t(kindKey) || tr.t('maint_CUSTOM');
      const over = d.state === 'OVERDUE';
      const [unit, n] =
        d.leftKm !== undefined ? (['Km', d.leftKm] as const)
        : d.leftDays !== undefined ? (['Days', d.leftDays] as const)
        : (['Hours', d.leftHours ?? 0] as const);
      const left = tr.t(`maint${over ? 'Over' : 'Soon'}${unit}` as MessageKey, {
        n: tr.number(Math.abs(Math.round(n))),
      });
      line = `🛠 <b>${tr.t('maintTask')}:</b> ${this.escapeHtml(task)}\n🔔 <b>${tr.t('alertState')}:</b> ${left}`;
    }

    const text =
      `${icon} <b>${title}</b>\n` +
      `\n` +
      `🚗 <b>${tr.t('geoVehicle')}:</b> ${this.escapeHtml(event.vehiclePlate)}${vehicleLabel}\n` +
      line +
      driverLine +
      `\n⏰ <b>${tr.t('geoTime')}:</b> ${tr.dateTime(event.timestamp)}`;

    return {
      text,
      parseMode: 'HTML',
      inlineKeyboard: [[{ text: tr.t('btnShowLocation'), callback_data: `loc:${event.vehicleId}` }]],
    };
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
