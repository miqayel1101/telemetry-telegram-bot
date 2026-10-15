export interface IGeofenceStreamEvent {
  eventId: string;
  fleetId: number;
  vehicleId: number;
  vehiclePlate: string;
  vehicleLabel: string | null;
  /** Zone alerts only; null for speeding, offline and maintenance */
  geofenceId: number | null;
  geofenceName: string;
  eventType: AlertEventType;
  timestamp: string;
  location: { lat: number; lng: number };
  driverName: string | null;
  details?: IAlertEventDetails | null;
}

export type AlertEventType = 'ENTRY' | 'EXIT' | 'SPEEDING' | 'OFFLINE' | 'MAINTENANCE';

/** What a speeding, offline or maintenance alert was about (as the core sends it) */
export interface IAlertEventDetails {
  speed?: number | null;
  limitKmh?: number;
  offlineMinutes?: number;
  lastSeenAt?: string;
  taskId?: number;
  kind?: string;
  title?: string | null;
  state?: 'DUE_SOON' | 'OVERDUE';
  leftKm?: number;
  leftDays?: number;
  leftHours?: number;
}
