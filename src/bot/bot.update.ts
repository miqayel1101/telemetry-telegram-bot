import { Update, Start, Command, Ctx, On, Action } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Logger } from 'nestjs-pino';
import { BotService } from './bot.service';
import { Public } from './decorators';
import { CallbackDispatcherService } from './menu/callback-dispatcher.service';
import { MenuService } from './menu/menu.service';
import { ScopeResolverService } from './menu/scope-resolver.service';
import { CoreApiService } from '../core-api/core-api.service';
import { TelegramAuthUser } from './interfaces';
import { I18nService } from '../i18n';

type AuthCtx = Context & { state: { user: TelegramAuthUser } };

const PAGE_SIZE = 8;

@Update()
export class BotUpdate {
  constructor(
    private readonly botService: BotService,
    private readonly callbackDispatcher: CallbackDispatcherService,
    private readonly menuService: MenuService,
    private readonly scopeResolver: ScopeResolverService,
    private readonly coreApiService: CoreApiService,
    private readonly logger: Logger,
    private readonly i18n: I18nService,
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

  @Public()
  @Command('language')
  async onLanguage(@Ctx() ctx: Context): Promise<void> {
    await this.botService.handleLanguagePrompt(ctx);
  }

  // Registered before the catch-all callback handler, and public: choosing a
  // language must work before the person has linked their account.
  @Public()
  @Action(/^lang:/)
  async onLanguageChosen(@Ctx() ctx: Context): Promise<void> {
    await this.botService.handleLanguageChosen(ctx);
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
    const menu = this.menuService.buildMainMenu(await this.i18n.forContext(ctx));
    await ctx.reply(menu.text, { reply_markup: menu.reply_markup });
  }

  @Command('vehicles')
  async onVehicles(@Ctx() ctx: AuthCtx): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const tr = await this.i18n.forContext(ctx);
    const scope = await this.scopeResolver.resolve(ctx);
    this.logger.log({
      msg: 'telegram.menu.command',
      command: 'vehicles',
      coreUserId,
      chatType: ctx.chat?.type,
      fleetId: scope.fleetId,
    });
    const response = await this.coreApiService.getVehicles(coreUserId, scope.fleetId, 0, PAGE_SIZE);
    if (!response) {
      await ctx.reply(tr.t('errorLoad'));
      return;
    }
    const menu = this.menuService.buildVehicleList(tr, {
      vehicles: response.data,
      total: response.total,
      page: 0,
      limit: PAGE_SIZE,
    });
    await ctx.reply(menu.text, { reply_markup: menu.reply_markup });
  }

  @Command('where')
  async onWhere(@Ctx() ctx: AuthCtx): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const tr = await this.i18n.forContext(ctx);
    const plate = this.commandArgument(ctx);

    this.logger.log({
      msg: 'telegram.menu.command',
      command: 'where',
      coreUserId,
      chatType: ctx.chat?.type,
    });

    if (!plate) {
      await ctx.reply(tr.t('whereUsage'));
      return;
    }

    const found = await this.coreApiService.findVehicleByPlate(coreUserId, plate);
    if (!found) {
      await ctx.reply(tr.t('errorLoad'));
      return;
    }
    if (!found.vehicle) {
      await ctx.reply(tr.t('plateNotFound', { plate }));
      return;
    }

    const telemetry = await this.coreApiService.getVehicleTelemetry(found.vehicle.id, coreUserId);
    if (!telemetry) {
      await ctx.reply(tr.t('vehicleGone'));
      return;
    }

    await ctx.replyWithLocation(telemetry.latitude, telemetry.longitude);
    await ctx.reply(
      tr.t('whereText', {
        plate: telemetry.licensePlate,
        speed: telemetry.speed,
        url: telemetry.googleMapsUrl,
      }),
    );
  }

  @Command('status')
  async onStatus(@Ctx() ctx: AuthCtx): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const tr = await this.i18n.forContext(ctx);
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
      await ctx.reply(tr.t('errorLoad'));
      return;
    }
    const menu = this.menuService.buildFleetStatus(tr, status);
    await ctx.reply(menu.text, { reply_markup: menu.reply_markup });
  }

  @Command('today')
  async onToday(@Ctx() ctx: AuthCtx): Promise<void> {
    const { coreUserId } = ctx.state.user;
    const tr = await this.i18n.forContext(ctx);
    const plate = this.commandArgument(ctx);

    this.logger.log({
      msg: 'telegram.menu.command',
      command: 'today',
      coreUserId,
      chatType: ctx.chat?.type,
    });

    if (!plate) {
      await ctx.reply(tr.t('todayUsage'));
      return;
    }

    const found = await this.coreApiService.findVehicleByPlate(coreUserId, plate);
    if (!found) {
      await ctx.reply(tr.t('errorLoad'));
      return;
    }
    if (!found.vehicle) {
      await ctx.reply(tr.t('plateNotFound', { plate }));
      return;
    }

    const trip = await this.coreApiService.getTripToday(found.vehicle.id, coreUserId);
    if (!trip) {
      await ctx.reply(tr.t('vehicleGone'));
      return;
    }

    const lines = [
      tr.t('tripTitlePlate', { plate: found.vehicle.licensePlate }),
      tr.t('tripDistance', { km: trip.distanceKm.toFixed(1) }),
      tr.t('tripDriving', { min: Math.round(trip.drivingTimeSeconds / 60) }),
      tr.t('tripStops', { count: trip.stops }),
    ];
    await ctx.reply(lines.join('\n'));
  }

  @Public()
  @Command('help')
  async onHelp(@Ctx() ctx: Context): Promise<void> {
    const tr = await this.i18n.forContext(ctx);
    await ctx.reply(tr.t('help'));
  }

  @On('callback_query')
  async onCallbackQuery(@Ctx() ctx: AuthCtx): Promise<void> {
    await this.callbackDispatcher.dispatch(ctx);
  }

  /** Everything after the command, e.g. "70 GG 007" from "/where 70 GG 007". */
  private commandArgument(ctx: Context): string | null {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : null;
  }
}
