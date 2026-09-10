import mongoose from 'mongoose';

import { UserRole } from '../../common/constants/roles.js';
import type { AuthUser } from '../../common/types/express.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { canAccessChecklistTemplate } from '../checklist-templates/checklist-template.access.js';
import * as checklistTemplateRepository from '../checklist-templates/checklist-template.repository.js';
import * as userRepository from '../users/user.repository.js';
import * as orderChecklistRepository from './order-checklist.repository.js';
import type { OrderChecklistResponse } from './order-checklist.types.js';
import { buildListOrdersFilter, canManageOrder, canViewOrder } from './order.access.js';
import { OrderStatus, type OrderStatusType } from './order.constants.js';
import type { OrderDocument } from './order.model.js';
import * as orderRepository from './order.repository.js';
import {
  assertActorAuthorizedForStatusTransition,
  assertStatusTransitionPreconditions,
  assertValidTransition,
} from './order.status.js';
import type {
  CreateOrderInput,
  ListOrdersQuery,
  OrderResponse,
  PaginatedOrdersResponse,
} from './order.types.js';

const validateClientForOrder = async (
  clientId: string,
  procurementManagerId: string,
): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    throw new AppError('Client not found', HttpStatus.NOT_FOUND, ErrorCode.CLIENT_NOT_FOUND);
  }

  const client = await userRepository.findById(clientId);

  if (!client) {
    throw new AppError('Client not found', HttpStatus.NOT_FOUND, ErrorCode.CLIENT_NOT_FOUND);
  }

  if (client.role !== UserRole.CLIENT) {
    throw new AppError(
      'User must have CLIENT role',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_CLIENT_ROLE,
    );
  }

  if (!client.isActive) {
    throw new AppError('Client is inactive', HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST);
  }

  if (client.createdBy?.toString() !== procurementManagerId) {
    throw new AppError('Client not found', HttpStatus.NOT_FOUND, ErrorCode.CLIENT_NOT_FOUND);
  }
};

const validateInspectionManagerForOrder = async (
  inspectionManagerId: string,
  procurementManagerId: string,
): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(inspectionManagerId)) {
    throw new AppError(
      'Inspection Manager not found',
      HttpStatus.NOT_FOUND,
      ErrorCode.INSPECTION_MANAGER_NOT_FOUND,
    );
  }

  const inspectionManager = await userRepository.findById(inspectionManagerId);

  if (!inspectionManager) {
    throw new AppError(
      'Inspection Manager not found',
      HttpStatus.NOT_FOUND,
      ErrorCode.INSPECTION_MANAGER_NOT_FOUND,
    );
  }

  if (inspectionManager.role !== UserRole.INSPECTION_MANAGER) {
    throw new AppError(
      'User must have INSPECTION_MANAGER role',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_INSPECTION_MANAGER_ROLE,
    );
  }

  if (!inspectionManager.isActive) {
    throw new AppError(
      'Inspection Manager is inactive',
      HttpStatus.BAD_REQUEST,
      ErrorCode.BAD_REQUEST,
    );
  }

  if (inspectionManager.managerId?.toString() !== procurementManagerId) {
    throw new AppError(
      'Inspection Manager not found',
      HttpStatus.NOT_FOUND,
      ErrorCode.INSPECTION_MANAGER_NOT_FOUND,
    );
  }
};

const isDuplicateKeyError = (error: unknown): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
};

const findOrderDocumentByOrderId = async (orderId: string): Promise<OrderDocument> => {
  const order = await orderRepository.findByOrderId(orderId);

  if (!order) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  return order;
};

export const getOrders = async (
  actor: AuthUser,
  query: ListOrdersQuery,
): Promise<PaginatedOrdersResponse> => {
  const filter = buildListOrdersFilter(actor, {
    status: query.status,
    clientId: query.clientId,
    inspectionManagerId: query.inspectionManagerId,
  });

  if (!filter) {
    throw new AppError('Insufficient permissions', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }

  const { orders, total } = await orderRepository.findPaginated(filter, query.page, query.limit);

  return {
    items: orders.map(orderRepository.toOrderResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};

export const getOrderByOrderId = async (
  actor: AuthUser,
  orderId: string,
): Promise<OrderResponse> => {
  const order = await findOrderDocumentByOrderId(orderId);

  if (!canViewOrder(actor, order)) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  return orderRepository.toOrderResponse(order);
};

export const createOrder = async (
  procurementManagerId: string,
  input: CreateOrderInput,
): Promise<OrderResponse> => {
  await validateClientForOrder(input.clientId, procurementManagerId);

  if (input.inspectionManagerId) {
    await validateInspectionManagerForOrder(input.inspectionManagerId, procurementManagerId);
  }

  const orderId = await orderRepository.generateOrderId();

  const order = await orderRepository.create({
    orderId,
    clientId: input.clientId,
    procurementManagerId,
    inspectionManagerId: input.inspectionManagerId,
    createdBy: procurementManagerId,
  });

  return orderRepository.toOrderResponse(order);
};

export const assignInspectionManager = async (
  actor: AuthUser,
  orderId: string,
  inspectionManagerId: string,
): Promise<OrderResponse> => {
  const order = await findOrderDocumentByOrderId(orderId);

  if (!canManageOrder(actor, order)) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  if (order.status !== OrderStatus.CREATED) {
    throw new AppError(
      'Inspection has already started for this order',
      HttpStatus.BAD_REQUEST,
      ErrorCode.ORDER_INSPECTION_ALREADY_STARTED,
    );
  }

  await validateInspectionManagerForOrder(
    inspectionManagerId,
    order.procurementManagerId.toString(),
  );

  const updatedOrder = await orderRepository.updateInspectionManager(orderId, inspectionManagerId);

  if (!updatedOrder) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  return orderRepository.toOrderResponse(updatedOrder);
};

export const updateOrderStatus = async (
  actor: AuthUser,
  orderId: string,
  targetStatus: OrderStatusType,
): Promise<OrderResponse> => {
  const order = await findOrderDocumentByOrderId(orderId);
  const hasChecklist = await orderChecklistRepository.existsByOrderId(orderId);

  assertValidTransition(order, targetStatus);
  assertStatusTransitionPreconditions(order, targetStatus, { hasChecklist });
  assertActorAuthorizedForStatusTransition(actor, order, targetStatus);

  const updatedOrder = await orderRepository.updateStatus(orderId, targetStatus);

  if (!updatedOrder) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  return orderRepository.toOrderResponse(updatedOrder);
};

export const attachChecklist = async (
  actor: AuthUser,
  orderId: string,
  checklistTemplateId: string,
): Promise<OrderChecklistResponse> => {
  const order = await findOrderDocumentByOrderId(orderId);

  if (!canManageOrder(actor, order)) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  if (order.status !== OrderStatus.CREATED) {
    throw new AppError(
      'Inspection has already started for this order',
      HttpStatus.BAD_REQUEST,
      ErrorCode.ORDER_INSPECTION_ALREADY_STARTED,
    );
  }

  if (await orderChecklistRepository.existsByOrderId(orderId)) {
    throw new AppError(
      'Checklist is already attached to this order',
      HttpStatus.CONFLICT,
      ErrorCode.ORDER_CHECKLIST_ALREADY_ATTACHED,
    );
  }

  if (!mongoose.Types.ObjectId.isValid(checklistTemplateId)) {
    throw new AppError('Checklist not found', HttpStatus.NOT_FOUND, ErrorCode.CHECKLIST_NOT_FOUND);
  }

  const template = await checklistTemplateRepository.findById(checklistTemplateId);

  if (!template || !canAccessChecklistTemplate(actor, template)) {
    throw new AppError('Checklist not found', HttpStatus.NOT_FOUND, ErrorCode.CHECKLIST_NOT_FOUND);
  }

  if (template.clientId.toString() !== order.clientId.toString()) {
    throw new AppError(
      'Checklist does not belong to the same client as the order',
      HttpStatus.BAD_REQUEST,
      ErrorCode.CHECKLIST_CLIENT_MISMATCH,
    );
  }

  try {
    const orderChecklist = await orderChecklistRepository.createSnapshot({
      orderId,
      checklistTemplateId: template._id.toString(),
      templateVersion: template.version,
      checklistName: template.name,
      questionsSnapshot: template.questions.map((question) => ({
        id: question.id,
        label: question.label,
        type: question.type,
        required: question.required,
        order: question.order,
        ...(question.options ? { options: [...question.options] } : {}),
      })),
    });

    return orderChecklistRepository.toOrderChecklistResponse(orderChecklist);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        'Checklist is already attached to this order',
        HttpStatus.CONFLICT,
        ErrorCode.ORDER_CHECKLIST_ALREADY_ATTACHED,
      );
    }

    throw error;
  }
};

export const completeInspectionForOrder = async (
  inspectionManagerId: string,
  orderId: string,
): Promise<OrderResponse> => {
  const order = await findOrderDocumentByOrderId(orderId);

  if (order.inspectionManagerId?.toString() !== inspectionManagerId) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  if (order.status !== OrderStatus.INSPECTION_IN_PROGRESS) {
    throw new AppError(
      `Cannot transition order from ${order.status} to ${OrderStatus.INSPECTION_COMPLETED}`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_ORDER_STATUS_TRANSITION,
    );
  }

  assertValidTransition(order, OrderStatus.INSPECTION_COMPLETED);

  const updatedOrder = await orderRepository.updateStatus(
    orderId,
    OrderStatus.INSPECTION_COMPLETED,
  );

  if (!updatedOrder) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  return orderRepository.toOrderResponse(updatedOrder);
};
