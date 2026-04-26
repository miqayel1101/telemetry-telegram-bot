import { Injectable } from '@nestjs/common';
import { FormattedAlert, IGeofenceStreamEvent } from './interfaces';

@Injectable()
export class AlertFormatterService {
  format(event: IGeofenceStreamEvent): FormattedAlert {
    const arrow = event.eventType === 'ENTRY' ? '➡️' : '⬅️';
    const action = event.eventType === 'ENTRY' ? 'entered' : 'exited';
    const ts = new Date(event.timestamp).toUTCString();

    const vehicleLabel = event.vehicleLabel
      ? ` (${this.escapeHtml(event.vehicleLabel)})`
      : '';

    const driverLine = event.driverName
      ? `\n👤 <b>Driver:</b> ${this.escapeHtml(event.driverName)}`
      : '';

    const text =
      `${arrow} <b>Geofence Alert</b>\n` +
      `\n` +
      `🚗 <b>Vehicle:</b> ${this.escapeHtml(event.vehiclePlate)}${vehicleLabel}\n` +
      `📍 <b>Zone:</b> ${this.escapeHtml(event.geofenceName)}\n` +
      `🔔 <b>Event:</b> ${action.charAt(0).toUpperCase() + action.slice(1)}` +
      driverLine +
      `\n⏰ <b>Time:</b> ${ts}`;

    const inlineKeyboard = [
      [
        {
          text: '📍 Location',
          callback_data: `loc:${event.vehicleId}`,
        },
        {
          text: '🚗 Vehicle',
          callback_data: `veh:${event.vehicleId}`,
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
