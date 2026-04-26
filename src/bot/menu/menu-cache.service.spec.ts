import { Test, TestingModule } from '@nestjs/testing';
import { MenuCacheService } from './menu-cache.service';
import { Logger } from 'nestjs-pino';

const mockLogger = { log: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };

async function buildService(): Promise<MenuCacheService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MenuCacheService,
      { provide: Logger, useValue: mockLogger },
    ],
  }).compile();
  return module.get<MenuCacheService>(MenuCacheService);
}

describe('MenuCacheService', () => {
  let service: MenuCacheService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await buildService();
  });

  describe('getVehicleList / setVehicleList', () => {
    it('returns null when no entry is cached', () => {
      expect(service.getVehicleList(1, 5)).toBeNull();
    });

    it('returns the cached value immediately after setting', () => {
      const payload = { data: [], total: 0, page: 0, limit: 10 };
      service.setVehicleList(1, 5, payload);
      expect(service.getVehicleList(1, 5)).toEqual(payload);
    });

    it('uses separate cache keys for different fleet IDs', () => {
      service.setVehicleList(1, 5, { data: [], total: 1, page: 0, limit: 10 });
      expect(service.getVehicleList(1, 99)).toBeNull();
    });

    it('returns null after the TTL has elapsed', () => {
      jest.useFakeTimers();
      const payload = { data: [], total: 0, page: 0, limit: 10 };
      service.setVehicleList(1, 5, payload);
      jest.advanceTimersByTime(16_000); // past 15s TTL
      expect(service.getVehicleList(1, 5)).toBeNull();
      jest.useRealTimers();
    });
  });

  describe('getStatus / setStatus', () => {
    it('returns null when no status is cached', () => {
      expect(service.getStatus(1, undefined)).toBeNull();
    });

    it('returns the cached status immediately after setting', () => {
      const payload = { fleetName: 'Fleet A', totalVehicles: 2, online: 1, offline: 1, alerts: 0 };
      service.setStatus(1, undefined, payload);
      expect(service.getStatus(1, undefined)).toEqual(payload);
    });

    it('returns null after the status TTL has elapsed', () => {
      jest.useFakeTimers();
      const payload = { fleetName: 'Fleet A', totalVehicles: 2, online: 1, offline: 1, alerts: 0 };
      service.setStatus(1, undefined, payload);
      jest.advanceTimersByTime(31_000); // past 30s TTL
      expect(service.getStatus(1, undefined)).toBeNull();
      jest.useRealTimers();
    });
  });
});
