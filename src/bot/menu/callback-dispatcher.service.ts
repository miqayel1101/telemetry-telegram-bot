import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Context } from 'telegraf';
import { VehiclesHandler } from './handlers/vehicles.handler';
import { VehicleDetailHandler } from './handlers/vehicle-detail.handler';
import { LocationHandler } from './handlers/location.handler';
import { StatusHandler } from './handlers/status.handler';
import { TripHandler } from './handlers/trip.handler';
import { MenuService } from './menu.service';
import { ScopeResolverService } from './scope-resolver.service';
import { TelegramAuthUser } from '../interfaces';
import { sendOrEdit } from './telegram-reply.util';

type AuthCtx = Context & { state: { user: TelegramAuthUser } };

@Injectable()
export class CallbackDispatcherService {
  constructor(
    private readonly vehiclesHandler: VehiclesHandler,
    private readonly vehicleDetailHandler: VehicleDetailHandler,
    private readonly locationHandler: LocationHandler,
    private readonly statusHandler: StatusHandler,
    private readonly tripHandler: TripHandler,
    private readonly menuService: MenuService,
    private readonly scopeResolver: ScopeResolverService,
    private readonly logger: Logger,
  ) {}

  async dispatch(ctx: AuthCtx): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) {
      return;
    }

    const raw = callbackQuery.data;
    const start = Date.now();
    const { coreUserId } = ctx.state.user;
    const scope = await this.scopeResolver.resolve(ctx);

    // Acknowledge the callback query immediately
    try {
      await ctx.answerCbQuery();
    } catch {
      // ignore ack errors
    }

    const parts = raw.split(':');
    const prefix = parts[0];

    this.logger.log({
      msg: 'telegram.menu.callback',
      callbackPrefix: prefix,
      coreUserId,
      chatType: ctx.chat?.type,
      latencyMs: Date.now() - start,
    });

    switch (prefix) {
      case 'menu': {
        const action = parts[1];
        if (action === 'vehicles') {
          await this.vehiclesHandler.handle(ctx, scope.fleetId, 0);
        } else if (action === 'status') {
          await this.statusHandler.handle(ctx, scope.fleetId);
        } else {
          await this.handleUnknown(ctx, raw);
        }
        break;
      }

      case 'veh': {
        const vehicleId = parseInt(parts[1], 10);
        if (isNaN(vehicleId)) {
          await this.handleUnknown(ctx, raw);
          return;
        }
        await this.vehicleDetailHandler.handle(ctx, vehicleId);
        break;
      }

      case 'loc': {
        const vehicleId = parseInt(parts[1], 10);
        if (isNaN(vehicleId)) {
          await this.handleUnknown(ctx, raw);
          return;
        }
        await this.locationHandler.handle(ctx, vehicleId);
        break;
      }

      case 'trip': {
        // trip:{vehicleId}:today
        const vehicleId = parseInt(parts[1], 10);
        if (isNaN(vehicleId)) {
          await this.handleUnknown(ctx, raw);
          return;
        }
        await this.tripHandler.handle(ctx, vehicleId);
        break;
      }

      case 'page': {
        const offset = parseInt(parts[1], 10);
        if (isNaN(offset)) {
          await this.handleUnknown(ctx, raw);
          return;
        }
        await this.vehiclesHandler.handle(ctx, scope.fleetId, offset);
        break;
      }

      case 'back': {
        const dest = parts[1];
        if (dest === 'menu') {
          const menu = this.menuService.buildMainMenu();
          await sendOrEdit(ctx, menu.text, menu.reply_markup, this.logger);
        } else if (dest === 'vehicles') {
          await this.vehiclesHandler.handle(ctx, scope.fleetId, 0);
        } else {
          await this.handleUnknown(ctx, raw);
        }
        break;
      }

      case 'fleet': {
        const fleetId = parseInt(parts[1], 10);
        if (isNaN(fleetId)) {
          await this.handleUnknown(ctx, raw);
          return;
        }
        await this.vehiclesHandler.handle(ctx, fleetId, 0);
        break;
      }

      default:
        await this.handleUnknown(ctx, raw);
    }
  }

  private async handleUnknown(ctx: Context & { state: { user: TelegramAuthUser } }, raw: string): Promise<void> {
    this.logger.warn({
      msg: 'telegram.menu.unknown-callback',
      rawCallbackData: raw,
      telegramUserId: ctx.from?.id,
    });
    try {
      await ctx.answerCbQuery('Unknown action');
    } catch {
      // ignore
    }
  }

}
