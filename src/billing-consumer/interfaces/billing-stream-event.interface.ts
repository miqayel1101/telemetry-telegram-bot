export type BillingEventType = 'overdue' | 'blocked' | 'unblocked' | 'paid';

export interface IBillingStreamEvent {
  eventId: string;
  type: BillingEventType;
  driverId: number;
  driverName: string;
  vehicleId: number;
  vehiclePlate: string;
  fleetId: number;
  amount: number;
  currency: string;
  timestamp: string;
}
