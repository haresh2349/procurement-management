import { UserRole } from '../../common/constants/roles.js';
import type { AuthUser } from '../../common/types/express.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ORDER_STATUS_TRANSITIONS, OrderStatus, type OrderStatusType } from './order.constants.js';
import type { OrderDocument } from './order.model.js';

export interface StatusTransitionContext {
  hasChecklist: boolean;
}

export const isValidTransition = (
  currentStatus: OrderStatusType,
  targetStatus: OrderStatusType,
): boolean => {
  return ORDER_STATUS_TRANSITIONS[currentStatus].includes(targetStatus);
};

export const assertValidTransition = (
  order: OrderDocument,
  targetStatus: OrderStatusType,
): void => {
  if (!isValidTransition(order.status, targetStatus)) {
    throw new AppError(
      `Cannot transition order from ${order.status} to ${targetStatus}`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_ORDER_STATUS_TRANSITION,
    );
  }
};

export const assertStartInspectionPreconditions = (
  order: OrderDocument,
  context: StatusTransitionContext,
): void => {
  if (!order.inspectionManagerId) {
    throw new AppError(
      'Order does not have an assigned Inspection Manager',
      HttpStatus.BAD_REQUEST,
      ErrorCode.ORDER_HAS_NO_INSPECTION_MANAGER,
    );
  }

  if (!context.hasChecklist) {
    throw new AppError(
      'Order does not have an attached checklist',
      HttpStatus.BAD_REQUEST,
      ErrorCode.ORDER_HAS_NO_CHECKLIST,
    );
  }
};

const isProcurementManagerOwner = (actor: AuthUser, order: OrderDocument): boolean => {
  return (
    actor.role === UserRole.PROCUREMENT_MANAGER &&
    order.procurementManagerId.toString() === actor.id
  );
};

export const assertActorAuthorizedForStatusTransition = (
  actor: AuthUser,
  order: OrderDocument,
  targetStatus: OrderStatusType,
): void => {
  if (
    order.status === OrderStatus.INSPECTION_IN_PROGRESS &&
    targetStatus === OrderStatus.INSPECTION_COMPLETED
  ) {
    throw new AppError(
      'Inspection must be submitted before completing inspection',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_ORDER_STATUS_TRANSITION,
    );
  }

  if (targetStatus === OrderStatus.INSPECTION_IN_PROGRESS) {
    if (actor.role !== UserRole.INSPECTION_MANAGER) {
      throw new AppError('Insufficient permissions', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
    }

    if (order.inspectionManagerId?.toString() !== actor.id) {
      throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
    }

    return;
  }

  if (targetStatus === OrderStatus.CANCELLED) {
    if (actor.role === UserRole.ADMIN || isProcurementManagerOwner(actor, order)) {
      return;
    }

    throw new AppError('Insufficient permissions', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }

  if (targetStatus === OrderStatus.APPROVED || targetStatus === OrderStatus.COMPLETED) {
    if (actor.role === UserRole.ADMIN || isProcurementManagerOwner(actor, order)) {
      return;
    }

    throw new AppError('Insufficient permissions', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }

  throw new AppError('Insufficient permissions', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
};

export const assertStatusTransitionPreconditions = (
  order: OrderDocument,
  targetStatus: OrderStatusType,
  context: StatusTransitionContext,
): void => {
  if (targetStatus === OrderStatus.INSPECTION_IN_PROGRESS) {
    assertStartInspectionPreconditions(order, context);
  }
};
