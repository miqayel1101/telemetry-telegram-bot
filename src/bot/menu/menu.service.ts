import { Injectable } from '@nestjs/common';
import { InlineKeyboardMarkup } from 'telegraf/types';
import { IFleetStatus } from '../../core-api/interfaces';
import { ITranslator } from '../../i18n';
import { IVehicleListPage } from './interfaces';

const PAGE_SIZE = 8;

@Injectable()
export class MenuService {
  buildMainMenu(tr: ITranslator): {
    text: string;
    reply_markup: InlineKeyboardMarkup;
  } {
    return {
      text: tr.t('menuTitle'),
      reply_markup: {
        inline_keyboard: [
          [{ text: tr.t('btnVehicles'), callback_data: 'menu:vehicles' }],
          [{ text: tr.t('btnStatus'), callback_data: 'menu:status' }],
        ],
      },
    };
  }

  buildVehicleList(
    tr: ITranslator,
    listPage: IVehicleListPage,
  ): { text: string; reply_markup: InlineKeyboardMarkup } {
    const { vehicles, total, page } = listPage;
    const limit = listPage.limit ?? PAGE_SIZE;
    const backRow = [{ text: tr.t('btnBackMenu'), callback_data: 'back:menu' }];

    if (vehicles.length === 0) {
      return {
        text: tr.t('vehiclesNone'),
        reply_markup: { inline_keyboard: [backRow] },
      };
    }

    const rows = vehicles.map((v) => [
      {
        text: `${v.licensePlate}${v.isActive ? '' : tr.t('inactiveSuffix')}`,
        callback_data: `veh:${v.id}`,
      },
    ]);

    const navRow: Array<{ text: string; callback_data: string }> = [];
    const offset = page * limit;
    if (offset > 0) {
      navRow.push({
        text: tr.t('btnPrev'),
        callback_data: `page:${offset - limit}`,
      });
    }
    if (offset + limit < total) {
      navRow.push({
        text: tr.t('btnNext'),
        callback_data: `page:${offset + limit}`,
      });
    }

    const keyboard = [...rows];
    if (navRow.length > 0) {
      keyboard.push(navRow);
    }
    keyboard.push(backRow);

    return {
      text: tr.t('vehiclesTitle', {
        from: offset + 1,
        to: Math.min(offset + vehicles.length, total),
        total,
      }),
      reply_markup: { inline_keyboard: keyboard },
    };
  }

  buildVehicleCard(
    tr: ITranslator,
    vehicle: { id: number; licensePlate: string; statusLine: string },
  ): { text: string; reply_markup: InlineKeyboardMarkup } {
    return {
      text: `${tr.t('vehicleTitle', { plate: vehicle.licensePlate })}\n${vehicle.statusLine}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: tr.t('btnShowMap'), callback_data: `loc:${vehicle.id}` }],
          [
            {
              text: tr.t('btnTodayTrip'),
              callback_data: `trip:${vehicle.id}:today`,
            },
          ],
          [{ text: tr.t('btnBackVehicles'), callback_data: 'back:vehicles' }],
        ],
      },
    };
  }

  buildFleetStatus(
    tr: ITranslator,
    status: IFleetStatus,
  ): { text: string; reply_markup: InlineKeyboardMarkup } {
    const lines = [
      status.fleetName ? tr.t('statusFleet', { name: status.fleetName }) : tr.t('statusAll'),
      tr.t('statusTotal', { count: status.totalVehicles }),
      tr.t('statusOnline', { count: status.online }),
      tr.t('statusOffline', { count: status.offline }),
    ];

    if (status.alerts > 0) {
      lines.push(tr.t('statusAlerts', { count: status.alerts }));
    }

    return {
      text: lines.join('\n'),
      reply_markup: {
        inline_keyboard: [
          [{ text: tr.t('btnRefresh'), callback_data: 'menu:status' }],
          [{ text: tr.t('btnBackMenu'), callback_data: 'back:menu' }],
        ],
      },
    };
  }

  buildFleetPicker(fleets: Array<{ id: number; name: string }>): {
    text: string;
    reply_markup: InlineKeyboardMarkup;
  } {
    if (fleets.length === 0) {
      return {
        text: 'No fleets available.',
        reply_markup: {
          inline_keyboard: [[{ text: 'Back to menu', callback_data: 'back:menu' }]],
        },
      };
    }

    const rows = fleets.map((f) => [{ text: f.name, callback_data: `fleet:${f.id}` }]);
    rows.push([{ text: 'Back to menu', callback_data: 'back:menu' }]);

    return {
      text: 'Select a fleet:',
      reply_markup: { inline_keyboard: rows },
    };
  }
}
