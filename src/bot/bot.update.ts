import { Update, Start, Command, Ctx, On } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Logger } from 'nestjs-pino';
import { BotService } from './bot.service';
import { Public } from './decorators';
import { CallbackDispatcherService } from './menu/callback-dispatcher.service';
import { MenuService } from './menu/menu.service';
import { ScopeResolverService } from './menu/scope-resolver.service';
import { CoreApiService } from '../core-api/core-api.service';
import { TelegramAuthUser } from './interfaces';

type AuthCtx = Context & { state: { user: TelegramAuthUser } };

@Update()
export class BotUpdate {
  constructor(
    private readonly botService: BotService,
    private readonly callbackDispatcher: CallbackDispatcherService,
    private readonly menuService: MenuService,
    private readonly scopeResolver: ScopeResolverService,
    private readonly coreApiService: CoreApiService,
    private readonly logger: Logger,
  ) {}

  @Public()
  @Start()
  async onStart(@Ctx() ctx: Context): Promise<void> {
    await this.botService.handleStart(ctx);
  }

  @Public()
  @Command('ping')
  async onPing(@Ctx() ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id ?? 0;
    const userId = ctx.from?.id ?? 0;
    const reply = this.botService.handlePing(chatId, userId);
    await ctx.reply(reply);
  }

  @Public()
  @Command('connect_group')
  async onConnectGroup(@Ctx() ctx: Context): Promise<void> {
    await this.botService.handleConnectGroup(ctx);
  }

  @Command('menu')
  async onMenu(@Ctx() ctx: AuthCtx): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const scope = await this.scopeResolver.resolve(ctx);
    this.logger.log({
      msg: 'telegram.menu.command',
      command: 'menu',
      coreUserId,
      chatType: ctx.chat?.type,
      fleetId: scope.fleetId,
    });
    const menu = this.menuService.buildMainMenu();
    await ctx.reply(menu.text, { reply_markup: menu.reply_markup });
  }

  @Command('vehicles')
  async onVehicles(@Ctx() ctx: AuthCtx): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const scope = await this.scopeResolver.resolve(ctx);
    this.logger.log({
      msg: 'telegram.menu.command',
      command: 'vehicles',
      coreUserId,
      chatType: ctx.chat?.type,
      fleetId: scope.fleetId,
    });
    const response = await this.coreApiService.getVehicles(coreUserId, scope.fleetId, 0, 8);
    if (!response) {
      await ctx.reply('Could not load data, please try again in a moment.');
      return;
    }
    const menu = this.menuService.buildVehicleList(response.data, response.total, 0, 8);
    await ctx.reply(menu.text, { reply_markup: menu.reply_markup });
  }

  @Command('where')
  async onWhere(@Ctx() ctx: AuthCtx): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.trim().split(/\s+/);
    const plate = parts.length > 1 ? parts.slice(1).join(' ') : null;

    this.logger.log({
      msg: 'telegram.menu.command',
      command: 'where',
      coreUserId,
      chatType: ctx.chat?.type,
    });

    if (!plate) {
      await ctx.reply('Usage: /where <license_plate>');
      return;
    }

    const vehicles = await this.coreApiService.getVehicles(coreUserId, undefined, 0, 50);
    if (!vehicles) {
      await ctx.reply('Could not load data, please try again in a moment.');
      return;
    }

    const match = vehicles.data.find(
      (v) => v.licensePlate.toLowerCase() === plate.toLowerCase(),
    );

    if (!match) {
      await ctx.reply(`No vehicle found with plate "${plate}".`);
      return;
    }

    const telemetry = await this.coreApiService.getVehicleTelemetry(match.id, coreUserId);
    if (!telemetry) {
      await ctx.reply('This vehicle is no longer available.');
      return;
    }

    await ctx.replyWithLocation(telemetry.latitude, telemetry.longitude);
    await ctx.reply(
      `${telemetry.licensePlate} — Speed: ${telemetry.speed} km/h\n${telemetry.googleMapsUrl}`,
    );
  }

  @Command('status')
  async onStatus(@Ctx() ctx: AuthCtx): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const scope = await this.scopeResolver.resolve(ctx);
    this.logger.log({
      msg: 'telegram.menu.command',
      command: 'status',
      coreUserId,
      chatType: ctx.chat?.type,
      fleetId: scope.fleetId,
    });
    const status = await this.coreApiService.getFleetStatus(coreUserId, scope.fleetId);
    if (!status) {
      await ctx.reply('Could not load data, please try again in a moment.');
      return;
    }
    const menu = this.menuService.buildFleetStatus(status);
    await ctx.reply(menu.text, { reply_markup: menu.reply_markup });
  }

  @Command('today')
  async onToday(@Ctx() ctx: AuthCtx): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.trim().split(/\s+/);
    const plate = parts.length > 1 ? parts.slice(1).join(' ') : null;

    this.logger.log({
      msg: 'telegram.menu.command',
      command: 'today',
      coreUserId,
      chatType: ctx.chat?.type,
    });

    if (!plate) {
      await ctx.reply('Usage: /today <license_plate>');
      return;
    }

    const vehicles = await this.coreApiService.getVehicles(coreUserId, undefined, 0, 50);
    if (!vehicles) {
      await ctx.reply('Could not load data, please try again in a moment.');
      return;
    }

    const match = vehicles.data.find(
      (v) => v.licensePlate.toLowerCase() === plate.toLowerCase(),
    );

    if (!match) {
      await ctx.reply(`No vehicle found with plate "${plate}".`);
      return;
    }

    const trip = await this.coreApiService.getTripToday(match.id, coreUserId);
    if (!trip) {
      await ctx.reply('This vehicle is no longer available.');
      return;
    }

    const drivingMin = Math.round(trip.drivingTimeSeconds / 60);
    const lines = [
      `Today's trip summary for ${match.licensePlate}:`,
      `Distance: ${trip.distanceKm.toFixed(1)} km`,
      `Driving time: ${drivingMin} min`,
      `Stops: ${trip.stops}`,
    ];
    await ctx.reply(lines.join('\n'));
  }

  @Public()
  @Command('help')
  async onHelp(@Ctx() ctx: Context): Promise<void> {
    const helpText = [
      'Available commands:',
      '/menu — Open interactive menu',
      '/vehicles — List your vehicles',
      '/where <plate> — Show vehicle location on map',
      '/status — Fleet status overview',
      '/today <plate> — Today\'s trip summary',
      '/help — Show this help message',
      '/ping — Check bot is alive',
    ].join('\n');
    await ctx.reply(helpText);
  }

  @On('callback_query')
  async onCallbackQuery(@Ctx() ctx: AuthCtx): Promise<void> {
    await this.callbackDispatcher.dispatch(ctx);
  }
}
