import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const VEHICLE_LIST_TTL_MS = 15_000;
const STATUS_TTL_MS = 30_000;

@Injectable()
export class MenuCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly logger: Logger) {}

  getVehicleList<T>(coreUserId: number, fleetId: number | undefined): T | null {
    const key = `vlist:${coreUserId}:${fleetId ?? 'all'}`;
    return this.get<T>(key);
  }

  setVehicleList<T>(coreUserId: number, fleetId: number | undefined, value: T): void {
    const key = `vlist:${coreUserId}:${fleetId ?? 'all'}`;
    this.set(key, value, VEHICLE_LIST_TTL_MS);
  }

  getStatus<T>(coreUserId: number, fleetId: number | undefined): T | null {
    const key = `status:${coreUserId}:${fleetId ?? 'all'}`;
    return this.get<T>(key);
  }

  setStatus<T>(coreUserId: number, fleetId: number | undefined, value: T): void {
    const key = `status:${coreUserId}:${fleetId ?? 'all'}`;
    this.set(key, value, STATUS_TTL_MS);
  }

  private get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return null;
    }
    this.logger.debug({
      msg: 'telegram.menu.cache-hit',
      cacheKey: key,
      ttlRemaining: entry.expiresAt - now,
    });
    return entry.value as T;
  }

  private set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}
