export interface IGeofenceStreamEvent {
  eventId: string;
  fleetId: number;
  vehicleId: number;
  vehiclePlate: string;
  vehicleLabel: string | null;
  geofenceId: number;
  geofenceName: string;
  eventType: 'ENTRY' | 'EXIT';
  timestamp: string;
  location: { lat: number; lng: number };
  driverName: string | null;
}
