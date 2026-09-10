import type { OrderStatusType } from './order.constants.js';

export interface OrderResponse {
  orderId: string;
  clientId: string;
  procurementManagerId: string;
  inspectionManagerId?: string;
  status: OrderStatusType;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderInput {
  clientId: string;
  inspectionManagerId?: string;
}

export interface CreateOrderPersistenceInput {
  orderId: string;
  clientId: string;
  procurementManagerId: string;
  inspectionManagerId?: string;
  createdBy: string;
}

export interface ListOrdersQuery {
  status?: OrderStatusType;
  clientId?: string;
  inspectionManagerId?: string;
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedOrdersResponse {
  items: OrderResponse[];
  pagination: PaginationMeta;
}
