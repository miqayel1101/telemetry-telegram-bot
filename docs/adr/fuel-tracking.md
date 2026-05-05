# ADR: fuel-tracking

**Date:** 2026-04-25
**Status:** Accepted
**Author:** Architecture Agent

## Context

Fleet owners need fuel monitoring to detect theft and track consumption costs. Teltonika devices already transmit fuel IO elements (85, 12, 73, 74, 75, 270, 272), but only IO 85 (Fuel Level %) is decoded. All raw IO data is persisted in `device_data.ioData` JSON, meaning historical analysis is possible without re-ingesting data.

## Decision

Introduce a `src/fuel/` NestJS module that expands IO decoding, adds anomaly detection (theft/refuel), and exposes fleet-level and vehicle-level fuel analytics via REST endpoints. Anomaly detection runs inline during device-data processing (not cron) to minimize detection latency.

## Bounded Context

**Owner:** `src/fuel/` (new module)
**Touches:** `src/teltonika/io-decoder.service.ts` (expand IO map), `src/common/interfaces/io-decoder.interface.ts` (expand `IKeyMetrics`), `src/device-data/device-data.service.ts` (hook anomaly check post-parse).

## Data Model Impact

### New entity: `fuel_events`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| vehicleId | integer NOT NULL | FK vehicles.id |
| driverId | integer NULL | FK drivers.id |
| type | enum('CONSUMPTION','REFUEL','SUSPECTED_THEFT') | |
| amountLiters | decimal(8,2) | absolute change |
| fuelLevelBefore | decimal(5,2) | percentage |
| fuelLevelAfter | decimal(5,2) | percentage |
| latitude | double precision | |
| longitude | double precision | |
| timestamp | timestamptz NOT NULL | device timestamp |
| acknowledged | boolean DEFAULT false | |
| acknowledgedByUserId | integer NULL | FK users.id |
| acknowledgedAt | timestamptz NULL | |

**Indexes:** `(vehicleId, timestamp DESC)`, `(type, timestamp DESC)`

### New entity: `fleet_fuel_config`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| fleetId | integer UNIQUE NOT NULL | FK fleets.id |
| tankCapacityLiters | integer NULL | converts % to liters |
| fuelPricePerLiter | decimal(8,2) NULL | |
| anomalyThresholdLiters | decimal(5,2) DEFAULT 10 | |
| currency | varchar(3) DEFAULT 'AMD' | |

### Modified interface: `IKeyMetrics`
Add fields: `fuelUsed?: number`, `fuelRate?: number`, `fuelLevelLiters?: number`

### Modified: IO decoder map
Add entries for IO IDs: 12, 73, 74, 75, 270, 272 with appropriate names, units, and transforms.

## Migration Path

- New migration creates `fuel_events` and `fleet_fuel_config` tables.
- No backfill required for `fuel_events` — anomaly detection only fires on new data going forward. Historical analysis is on-demand via queries against existing `device_data.ioData`.
- `fleet_fuel_config` starts empty; fleet admins configure per-fleet settings through the dashboard.
- IO decoder additions are purely additive — no existing data is modified.

## Service Boundaries

### New HTTP Endpoints (all behind JWT + permission guard)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/fuel/vehicle/:id/summary` | Consumption, avg L/100km, cost, anomaly count |
| GET | `/api/fuel/vehicle/:id/history` | Fuel level timeline (for charts) |
| GET | `/api/fuel/vehicle/:id/anomalies` | Suspected theft/refuel events |
| GET | `/api/fuel/fleet/:fleetId/report` | Fleet-wide consumption + cost report |
| POST | `/api/fuel/anomalies/:id/acknowledge` | Mark anomaly as reviewed |
| GET | `/api/fuel/fleet/:fleetId/config` | Get fleet fuel config |
| PUT | `/api/fuel/fleet/:fleetId/config` | Upsert fleet fuel config |

All query endpoints accept `?from=&to=` ISO date range params.

### Upstream Callers
- Dashboard client (VehicleDetailPage fuel tab, new fleet fuel report page)
- Mobile app (future)

### Downstream Dependencies
- `device_data` table (read ioData for fuel level extraction)
- `vehicles`, `fleets`, `drivers` tables (joins)
- Realtime gateway: emit `fuel:anomaly` event on WebSocket when theft detected

### Internal Integration
- `DeviceDataService.processRecord()` calls `FuelService.checkAnomaly()` after parsing each record.

## Failure Modes

1. **Fuel sensor returns erratic readings (bouncing values):** Apply a smoothing window (3-point rolling average) before anomaly comparison. Without this, false positives flood the anomaly table. The service discards changes < 2% as noise.

2. **No fuel IO elements present in device data (device not configured):** `checkAnomaly()` short-circuits if IO 85/270/272 are all absent. No fuel_events created. Vehicle fuel tab shows "No fuel sensor configured" state.

3. **Fleet fuel config missing when computing costs:** Cost fields return `null` in API responses. UI shows consumption in liters only, with a prompt to configure fuel price. No error thrown.

4. **High volume of device data overwhelms inline anomaly check:** The check is O(1) per record (compare current vs previous fuel level cached in Redis per vehicle). If Redis is unavailable, skip anomaly detection silently and log a warning — data ingestion must never block on fuel analysis.

## Observability

- **Metric:** `fuel.anomaly.detected` counter, tagged by `type` (THEFT/REFUEL) and `vehicleId`
- **Metric:** `fuel.check.duration_ms` histogram — latency of inline anomaly check
- **Log event:** `fuel.anomaly.created` at WARN level with vehicleId, type, amount, location
- **Log event:** `fuel.check.skipped` at WARN level when Redis unavailable
- **Trace:** Span `FuelService.checkAnomaly` nested under device-data processing span

## Rollback Plan

1. **Feature flag:** `FUEL_TRACKING_ENABLED` env var (default `false` in first deploy). When `false`, anomaly check is skipped and fuel endpoints return 404.
2. **Migration reversal:** Drop `fuel_events` and `fleet_fuel_config` tables (no other tables modified).
3. **IO decoder changes are additive and harmless** — extra decoded fields in IKeyMetrics have no downstream consumers if fuel module is disabled.
4. **Client:** Fuel tab hidden behind same feature flag check from `/api/config` endpoint.

## Alternatives Considered

1. **Cron-based anomaly detection (scan device_data periodically):** Rejected — adds detection latency (minutes), requires tracking "last processed" cursor per vehicle, and duplicates queries. Inline check with Redis-cached previous level is simpler and real-time.

2. **Separate TimescaleDB hypertable for fuel data:** Rejected — fuel data is already in `device_data` ioData JSON. Duplicating into a separate time-series table adds write amplification without proportional query benefit. If query performance degrades, a continuous aggregate or materialized view can be added later.

3. **External analytics service (separate microservice for fuel):** Rejected — the team runs a monolithic NestJS backend; adding a separate service for one domain increases operational complexity with no clear scaling need.

## Consequences

- Fleet operators gain theft detection and cost visibility without hardware changes.
- IO decoder grows by 6 entries — keep the map sorted by ID for maintainability.
- Redis gains per-vehicle fuel level cache keys (`fuel:last:{vehicleId}`) — TTL 24h, negligible memory.
- Dashboard adds two new pages/tabs — follow existing dark-theme Recharts patterns from trips/stats pages.
