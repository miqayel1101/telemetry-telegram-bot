import { Module } from '@nestjs/common';
import { CoreApiModule } from '../../core-api/core-api.module';
import { CallbackDispatcherService } from './callback-dispatcher.service';
import { MenuService } from './menu.service';
import { MenuCacheService } from './menu-cache.service';
import { ScopeResolverService } from './scope-resolver.service';
import { VehiclesHandler } from './handlers/vehicles.handler';
import { VehicleDetailHandler } from './handlers/vehicle-detail.handler';
import { LocationHandler } from './handlers/location.handler';
import { StatusHandler } from './handlers/status.handler';
import { TripHandler } from './handlers/trip.handler';
import { FleetPickerHandler } from './handlers/fleet-picker.handler';

@Module({
  imports: [CoreApiModule],
  providers: [
    CallbackDispatcherService,
    MenuService,
    MenuCacheService,
    ScopeResolverService,
    VehiclesHandler,
    VehicleDetailHandler,
    LocationHandler,
    StatusHandler,
    TripHandler,
    FleetPickerHandler,
  ],
  exports: [CallbackDispatcherService, MenuService, ScopeResolverService, FleetPickerHandler],
})
export class MenuModule {}
