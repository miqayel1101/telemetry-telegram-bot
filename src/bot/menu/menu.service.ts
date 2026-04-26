import { Injectable } from '@nestjs/common';
import { InlineKeyboardMarkup } from 'telegraf/types';
import { IVehicleListItem, IFleetStatus } from '../../core-api/interfaces';

const PAGE_SIZE = 8;

@Injectable()
export class MenuService {
  buildMainMenu(): { text: string; reply_markup: InlineKeyboardMarkup } {
    return {
      text: 'Select an option:',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Vehicles', callback_data: 'menu:vehicles' }],
          [{ text: 'Fleet Status', callback_data: 'menu:status' }],
        ],
      },
    };
  }

  buildVehicleList(
    vehicles: IVehicleListItem[],
    total: number,
    page: number,
    limit: number = PAGE_SIZE,
  ): { text: string; reply_markup: InlineKeyboardMarkup } {
    if (vehicles.length === 0) {
      return {
        text: 'No vehicles found.',
        reply_markup: {
          inline_keyboard: [[{ text: 'Back to menu', callback_data: 'back:menu' }]],
        },
      };
    }

    const rows = vehicles.map((v) => [
      {
        text: `${v.licensePlate}${v.isActive ? '' : ' (inactive)'}`,
        callback_data: `veh:${v.id}`,
      },
    ]);

    const navRow: Array<{ text: string; callback_data: string }> = [];
    const offset = page * limit;
    if (offset > 0) {
      navRow.push({ text: 'Prev', callback_data: `page:${offset - limit}` });
    }
    if (offset + limit < total) {
      navRow.push({ text: 'Next', callback_data: `page:${offset + limit}` });
    }

    const keyboard = [...rows];
    if (navRow.length > 0) {
      keyboard.push(navRow);
    }
    keyboard.push([{ text: 'Back to menu', callback_data: 'back:menu' }]);

    const showing = `${offset + 1}–${Math.min(offset + vehicles.length, total)} of ${total}`;

    return {
      text: `Vehicles (${showing}):`,
      reply_markup: { inline_keyboard: keyboard },
    };
  }

  buildVehicleCard(
    vehicleId: number,
    licensePlate: string,
    statusLine: string,
  ): { text: string; reply_markup: InlineKeyboardMarkup } {
    return {
      text: `Vehicle: ${licensePlate}\n${statusLine}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Show on map', callback_data: `loc:${vehicleId}` }],
          [{ text: "Today's trip", callback_data: `trip:${vehicleId}:today` }],
          [{ text: 'Back to vehicles', callback_data: 'back:vehicles' }],
        ],
      },
    };
  }

  buildFleetStatus(status: IFleetStatus): { text: string; reply_markup: InlineKeyboardMarkup } {
    const lines = [
      `Fleet: ${status.fleetName}`,
      `Total: ${status.totalVehicles} vehicles`,
      `Online: ${status.online}`,
      `Offline: ${status.offline}`,
    ];

    if (status.alerts > 0) {
      lines.push(`Alerts: ${status.alerts}`);
    }

    return {
      text: lines.join('\n'),
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Refresh', callback_data: 'menu:status' }],
          [{ text: 'Back to menu', callback_data: 'back:menu' }],
        ],
      },
    };
  }

  buildFleetPicker(
    fleets: Array<{ id: number; name: string }>,
  ): { text: string; reply_markup: InlineKeyboardMarkup } {
    if (fleets.length === 0) {
      return {
        text: 'No fleets available.',
        reply_markup: { inline_keyboard: [[{ text: 'Back to menu', callback_data: 'back:menu' }]] },
      };
    }

    const rows = fleets.map((f) => [
      { text: f.name, callback_data: `fleet:${f.id}` },
    ]);
    rows.push([{ text: 'Back to menu', callback_data: 'back:menu' }]);

    return {
      text: 'Select a fleet:',
      reply_markup: { inline_keyboard: rows },
    };
  }
}
