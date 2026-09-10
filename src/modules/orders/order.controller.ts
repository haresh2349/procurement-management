import type { Request, Response } from 'express';

import { HttpStatus } from '../../common/constants/http-status.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { successResponse } from '../../common/types/api-response.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import * as orderService from './order.service.js';
import type {
  AssignInspectionManagerBody,
  AttachChecklistBody,
  CreateOrderBody,
  ListOrdersQueryInput,
  UpdateOrderStatusBody,
} from './order.validation.js';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }

  return req.user;
};

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const order = await orderService.createOrder(actor.id, req.body as CreateOrderBody);

  res.status(HttpStatus.CREATED).json(successResponse(order, 'Order created successfully'));
});

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const query = res.locals.validatedQuery as ListOrdersQueryInput;
  const orders = await orderService.getOrders(actor, query);

  res.status(HttpStatus.OK).json(successResponse(orders, 'Orders retrieved successfully'));
});

export const getOrderByOrderId = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { orderId } = res.locals.validatedParams as { orderId: string };
  const order = await orderService.getOrderByOrderId(actor, orderId);

  res.status(HttpStatus.OK).json(successResponse(order, 'Order retrieved successfully'));
});

export const assignInspectionManager = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { orderId } = res.locals.validatedParams as { orderId: string };
  const body = req.body as AssignInspectionManagerBody;
  const order = await orderService.assignInspectionManager(actor, orderId, body.inspectionManagerId);

  res
    .status(HttpStatus.OK)
    .json(successResponse(order, 'Inspection Manager assigned successfully'));
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { orderId } = res.locals.validatedParams as { orderId: string };
  const body = req.body as UpdateOrderStatusBody;
  const order = await orderService.updateOrderStatus(actor, orderId, body.status);

  res.status(HttpStatus.OK).json(successResponse(order, 'Order status updated successfully'));
});

export const attachChecklist = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { orderId } = res.locals.validatedParams as { orderId: string };
  const body = req.body as AttachChecklistBody;
  const orderChecklist = await orderService.attachChecklist(
    actor,
    orderId,
    body.checklistTemplateId,
  );

  res
    .status(HttpStatus.CREATED)
    .json(successResponse(orderChecklist, 'Checklist attached successfully'));
});
