import { Test, TestingModule } from '@nestjs/testing';
import { CallbackDispatcherService } from './callback-dispatcher.service';
import { VehiclesHandler } from './handlers/vehicles.handler';
import { VehicleDetailHandler } from './handlers/vehicle-detail.handler';
import { LocationHandler } from './handlers/location.handler';
import { StatusHandler } from './handlers/status.handler';
import { TripHandler } from './handlers/trip.handler';
import { MenuService } from './menu.service';
import { ScopeResolverService } from './scope-resolver.service';
import { Logger } from 'nestjs-pino';

const mockLogger = { log: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };

const mockVehiclesHandler = { handle: jest.fn() };
const mockVehicleDetailHandler = { handle: jest.fn() };
const mockLocationHandler = { handle: jest.fn() };
const mockStatusHandler = { handle: jest.fn() };
const mockTripHandler = { handle: jest.fn() };
const mockMenuService = {
  buildMainMenu: jest.fn().mockReturnValue({ text: 'Menu', reply_markup: { inline_keyboard: [] } }),
};
const mockScopeResolver = {
  resolve: jest.fn().mockResolvedValue({ fleetId: undefined, isGroupChat: false }),
};

function makeCtx(callbackData: string) {
  const ctx = {
    callbackQuery: { data: callbackData },
    chat: { type: 'private', id: 100 },
    from: { id: 200 },
    state: { user: { coreUserId: 1, telegramUserId: '200' } },
    answerCbQuery: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    editMessageText: jest.fn().mockResolvedValue(undefined),
  };
  return ctx;
}

async function buildService(): Promise<CallbackDispatcherService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CallbackDispatcherService,
      { provide: VehiclesHandler, useValue: mockVehiclesHandler },
      { provide: VehicleDetailHandler, useValue: mockVehicleDetailHandler },
      { provide: LocationHandler, useValue: mockLocationHandler },
      { provide: StatusHandler, useValue: mockStatusHandler },
      { provide: TripHandler, useValue: mockTripHandler },
      { provide: MenuService, useValue: mockMenuService },
      { provide: ScopeResolverService, useValue: mockScopeResolver },
      { provide: Logger, useValue: mockLogger },
    ],
  }).compile();
  return module.get<CallbackDispatcherService>(CallbackDispatcherService);
}

describe('CallbackDispatcherService', () => {
  let service: CallbackDispatcherService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await buildService();
  });

  it('routes menu:vehicles to VehiclesHandler', async () => {
    const ctx = makeCtx('menu:vehicles');
    await service.dispatch(ctx as never);
    expect(mockVehiclesHandler.handle).toHaveBeenCalledWith(ctx, undefined, 0);
  });

  it('routes menu:status to StatusHandler', async () => {
    const ctx = makeCtx('menu:status');
    await service.dispatch(ctx as never);
    expect(mockStatusHandler.handle).toHaveBeenCalledWith(ctx, undefined);
  });

  it('routes veh:42 to VehicleDetailHandler', async () => {
    const ctx = makeCtx('veh:42');
    await service.dispatch(ctx as never);
    expect(mockVehicleDetailHandler.handle).toHaveBeenCalledWith(ctx, 42);
  });

  it('routes loc:7 to LocationHandler', async () => {
    const ctx = makeCtx('loc:7');
    await service.dispatch(ctx as never);
    expect(mockLocationHandler.handle).toHaveBeenCalledWith(ctx, 7);
  });

  it('routes trip:5:today to TripHandler', async () => {
    const ctx = makeCtx('trip:5:today');
    await service.dispatch(ctx as never);
    expect(mockTripHandler.handle).toHaveBeenCalledWith(ctx, 5);
  });

  it('routes page:8 to VehiclesHandler with offset=8', async () => {
    const ctx = makeCtx('page:8');
    await service.dispatch(ctx as never);
    expect(mockVehiclesHandler.handle).toHaveBeenCalledWith(ctx, undefined, 8);
  });

  it('routes back:menu to buildMainMenu and editMessageText', async () => {
    const ctx = makeCtx('back:menu');
    await service.dispatch(ctx as never);
    expect(mockMenuService.buildMainMenu).toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalled();
  });

  it('routes back:vehicles to VehiclesHandler offset=0', async () => {
    const ctx = makeCtx('back:vehicles');
    await service.dispatch(ctx as never);
    expect(mockVehiclesHandler.handle).toHaveBeenCalledWith(ctx, undefined, 0);
  });

  it('answers with Unknown action for unknown prefix', async () => {
    const ctx = makeCtx('unknown:data');
    await service.dispatch(ctx as never);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'telegram.menu.unknown-callback' }),
    );
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Unknown action');
  });

  it('does nothing when callbackQuery has no data field', async () => {
    const ctx = {
      callbackQuery: {},
      state: { user: { coreUserId: 1, telegramUserId: '200' } },
      answerCbQuery: jest.fn(),
    };
    await service.dispatch(ctx as never);
    expect(mockVehiclesHandler.handle).not.toHaveBeenCalled();
  });
});
