export interface IVehicleListItem {
  id: number;
  licensePlate: string;
  imei: string;
  makeId: number | null;
  modelId: number | null;
  year: number | null;
  isActive: boolean;
}

export interface IVehicleListResponse {
  data: IVehicleListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface IVehicleTelemetry {
  id: number;
  licensePlate: string;
  latitude: number;
  longitude: number;
  speed: number;
  ignition: boolean | null;
  timestamp: string;
  googleMapsUrl: string;
}

export interface IFleetStatus {
  // null when the status covers everything the person can see, not one fleet
  fleetName: string | null;
  totalVehicles: number;
  online: number;
  offline: number;
  alerts: number;
}

export interface ITripTodaySummary {
  distanceKm: number;
  drivingTimeSeconds: number;
  stops: number;
  startLocation: { latitude: number; longitude: number } | null;
  endLocation: { latitude: number; longitude: number } | null;
}
