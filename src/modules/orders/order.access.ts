import mongoose from 'mongoose';

import type { AuthUser } from '../../common/types/express.js';
import { UserRole } from '../../common/constants/roles.js';
import type { OrderStatusType } from './order.constants.js';
import type { OrderDocument } from './order.model.js';

export interface ListOrdersQueryFilters {
  status?: OrderStatusType;
  clientId?: string;
  inspectionManagerId?: string;
}

export const canManageOrder = (actor: AuthUser, order: OrderDocument): boolean => {
  if (actor.role === UserRole.ADMIN) {
    return true;
  }

  if (actor.role === UserRole.PROCUREMENT_MANAGER) {
    return order.procurementManagerId.toString() === actor.id;
  }

  return false;
};

export const canViewOrder = (actor: AuthUser, order: OrderDocument): boolean => {
  if (actor.role === UserRole.ADMIN) {
    return true;
  }

  if (actor.role === UserRole.PROCUREMENT_MANAGER) {
    return order.procurementManagerId.toString() === actor.id;
  }

  if (actor.role === UserRole.INSPECTION_MANAGER) {
    return order.inspectionManagerId?.toString() === actor.id;
  }

  if (actor.role === UserRole.CLIENT) {
    return order.clientId.toString() === actor.id;
  }

  return false;
};

const applyRequestFilters = (
  filter: Record<string, unknown>,
  query?: ListOrdersQueryFilters,
): Record<string, unknown> => {
  if (!query) {
    return filter;
  }

  const requestFilters: Record<string, unknown> = {};

  if (query.status) {
    requestFilters.status = query.status;
  }

  if (query.clientId) {
    requestFilters.clientId = new mongoose.Types.ObjectId(query.clientId);
  }

  if (query.inspectionManagerId) {
    requestFilters.inspectionManagerId = new mongoose.Types.ObjectId(query.inspectionManagerId);
  }

  if (Object.keys(requestFilters).length === 0) {
    return filter;
  }

  return {
    $and: [filter, requestFilters],
  };
};

export const buildListOrdersFilter = (
  actor: AuthUser,
  query?: ListOrdersQueryFilters,
): Record<string, unknown> | null => {
  if (actor.role === UserRole.ADMIN) {
    return applyRequestFilters({}, query);
  }

  if (actor.role === UserRole.PROCUREMENT_MANAGER) {
    return applyRequestFilters(
      { procurementManagerId: new mongoose.Types.ObjectId(actor.id) },
      query,
    );
  }

  if (actor.role === UserRole.INSPECTION_MANAGER) {
    const authorizationFilter = {
      inspectionManagerId: new mongoose.Types.ObjectId(actor.id),
    };

    return applyRequestFilters(authorizationFilter, {
      status: query?.status,
      clientId: query?.clientId,
    });
  }

  if (actor.role === UserRole.CLIENT) {
    const authorizationFilter = {
      clientId: new mongoose.Types.ObjectId(actor.id),
    };

    return applyRequestFilters(authorizationFilter, {
      status: query?.status,
      inspectionManagerId: query?.inspectionManagerId,
    });
  }

  return null;
};
