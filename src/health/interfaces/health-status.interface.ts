export interface HealthStatus {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  redis: 'up' | 'down';
  telegram: 'up' | 'down';
  uptime: number;
}
