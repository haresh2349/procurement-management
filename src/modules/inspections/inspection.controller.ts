import type { Request, Response } from 'express';

import { HttpStatus } from '../../common/constants/http-status.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { successResponse } from '../../common/types/api-response.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import type { OrderChecklistAnswer } from '../orders/order-checklist.answer-types.js';
import * as inspectionService from './inspection.service.js';
import type { UpdateChecklistAnswersBody } from './inspection.validation.js';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }

  return req.user;
};

export const getOrderChecklist = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { orderId } = res.locals.validatedParams as { orderId: string };
  const orderChecklist = await inspectionService.getOrderChecklist(actor, orderId);

  res
    .status(HttpStatus.OK)
    .json(successResponse(orderChecklist, 'Order checklist retrieved successfully'));
});

export const updateChecklistAnswers = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { orderId } = res.locals.validatedParams as { orderId: string };
  const body = req.body as UpdateChecklistAnswersBody;
  const orderChecklist = await inspectionService.updateChecklistAnswers(
    actor,
    orderId,
    body.answers as OrderChecklistAnswer[],
  );

  res
    .status(HttpStatus.OK)
    .json(successResponse(orderChecklist, 'Checklist answers updated successfully'));
});

export const submitInspection = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { orderId } = res.locals.validatedParams as { orderId: string };
  const orderChecklist = await inspectionService.submitInspection(actor, orderId);

  res
    .status(HttpStatus.OK)
    .json(successResponse(orderChecklist, 'Inspection submitted successfully'));
});
