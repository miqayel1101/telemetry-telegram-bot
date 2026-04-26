import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import {
  UserDisplayName,
  FleetDisplayName,
  IVehicleListResponse,
  IVehicleTelemetry,
  IFleetStatus,
  ITripTodaySummary,
} from './interfaces';

const FETCH_TIMEOUT_MS = 3_000;

@Injectable()
export class CoreApiService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.baseUrl = this.configService.get<string>('coreApiUrl', 'http://localhost:3001');
    this.apiKey = this.configService.get<string>('coreApiKey', '');
  }

  async getUserDisplayName(userId: number): Promise<UserDisplayName | null> {
    const endpoint = `/api/internal/users/${userId}/display-name`;
    const data = await this.fetchInternal(endpoint);
    if (data === null) return null;
    if (
      typeof (data as Record<string, unknown>).firstName !== 'string' ||
      typeof (data as Record<string, unknown>).lastName !== 'string' ||
      typeof (data as Record<string, unknown>).email !== 'string'
    ) {
      this.logger.warn({ msg: 'core.api.unreachable', endpoint, error: 'Unexpected response shape' });
      return null;
    }
    return data as UserDisplayName;
  }

  async getFleetDisplayName(fleetId: number): Promise<FleetDisplayName | null> {
    const endpoint = `/api/internal/fleets/${fleetId}/display-name`;
    const data = await this.fetchInternal(endpoint);
    if (data === null) return null;
    if (
      typeof (data as Record<string, unknown>).name !== 'string' ||
      typeof (data as Record<string, unknown>).companyName !== 'string' ||
      typeof (data as Record<string, unknown>).companyId !== 'number'
    ) {
      this.logger.warn({ msg: 'core.api.unreachable', endpoint, error: 'Unexpected response shape' });
      return null;
    }
    return data as FleetDisplayName;
  }

  async getVehicles(
    userId: number,
    fleetId?: number,
    page = 0,
    limit = 10,
  ): Promise<IVehicleListResponse | null> {
    const params = new URLSearchParams({ userId: String(userId), page: String(page), limit: String(limit) });
    if (fleetId !== undefined) {
      params.set('fleetId', String(fleetId));
    }
    const endpoint = `/api/internal/vehicles?${params.toString()}`;
    const data = await this.fetchInternal(endpoint);
    if (data === null) return null;
    const d = data as Record<string, unknown>;
    if (!Array.isArray(d.data) || typeof d.total !== 'number') {
      this.logger.warn({ msg: 'core.api.unreachable', endpoint, error: 'Unexpected response shape' });
      return null;
    }
    return data as IVehicleListResponse;
  }

  async getVehicleTelemetry(vehicleId: number, userId: number): Promise<IVehicleTelemetry | null> {
    const endpoint = `/api/internal/vehicles/${vehicleId}/telemetry?userId=${userId}`;
    const data = await this.fetchInternal(endpoint);
    if (data === null) return null;
    const d = data as Record<string, unknown>;
    if (typeof d.latitude !== 'number' || typeof d.longitude !== 'number') {
      this.logger.warn({ msg: 'core.api.unreachable', endpoint, error: 'Unexpected response shape' });
      return null;
    }
    return data as IVehicleTelemetry;
  }

  async getFleetStatus(userId: number, fleetId?: number): Promise<IFleetStatus | null> {
    const params = new URLSearchParams({ userId: String(userId) });
    if (fleetId !== undefined) {
      params.set('fleetId', String(fleetId));
    }
    const endpoint = `/api/internal/fleets/status?${params.toString()}`;
    const data = await this.fetchInternal(endpoint);
    if (data === null) return null;
    const d = data as Record<string, unknown>;
    if (typeof d.totalVehicles !== 'number') {
      this.logger.warn({ msg: 'core.api.unreachable', endpoint, error: 'Unexpected response shape' });
      return null;
    }
    return data as IFleetStatus;
  }

  async getTripToday(vehicleId: number, userId: number): Promise<ITripTodaySummary | null> {
    const endpoint = `/api/internal/trips/today?vehicleId=${vehicleId}&userId=${userId}`;
    const data = await this.fetchInternal(endpoint);
    if (data === null) return null;
    const d = data as Record<string, unknown>;
    if (typeof d.distanceKm !== 'number') {
      this.logger.warn({ msg: 'core.api.unreachable', endpoint, error: 'Unexpected response shape' });
      return null;
    }
    return data as ITripTodaySummary;
  }

  private async fetchInternal(endpoint: string): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          'X-Core-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn({
          msg: 'core.api.unreachable',
          endpoint,
          httpStatus: response.status,
        });
        return null;
      }

      return (await response.json()) as unknown;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn({
        msg: 'core.api.unreachable',
        endpoint,
        error: message,
      });
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
