import type { AuthUser } from '../../common/types/express.js';
import { UserRole } from '../../common/constants/roles.js';
import { OrderStatus } from '../orders/order.constants.js';
import type { OrderDocument } from '../orders/order.model.js';
import { canViewOrder } from '../orders/order.access.js';

export const canViewOrderChecklist = (actor: AuthUser, order: OrderDocument): boolean => {
  return canViewOrder(actor, order);
};

export const canUpdateInspectionAnswers = (actor: AuthUser, order: OrderDocument): boolean => {
  return (
    actor.role === UserRole.INSPECTION_MANAGER &&
    order.inspectionManagerId?.toString() === actor.id &&
    order.status === OrderStatus.INSPECTION_IN_PROGRESS
  );
};

export const canSubmitInspection = (actor: AuthUser, order: OrderDocument): boolean => {
  return canUpdateInspectionAnswers(actor, order);
};
