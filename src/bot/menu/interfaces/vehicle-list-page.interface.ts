import { IVehicleListItem } from '../../../core-api/interfaces';

export interface IVehicleListPage {
  vehicles: IVehicleListItem[];
  total: number;
  page: number;
  limit?: number;
}
