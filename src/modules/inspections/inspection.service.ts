import type { AuthUser } from '../../common/types/express.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import * as fileRepository from '../files/file.repository.js';
import { OrderStatus } from '../orders/order.constants.js';
import type { OrderChecklistAnswer } from '../orders/order-checklist.answer-types.js';
import type { OrderChecklistDocument } from '../orders/order-checklist.model.js';
import * as orderChecklistRepository from '../orders/order-checklist.repository.js';
import type { OrderChecklistResponse } from '../orders/order-checklist.types.js';
import type { OrderDocument } from '../orders/order.model.js';
import * as orderRepository from '../orders/order.repository.js';
import { assertValidTransition } from '../orders/order.status.js';
import {
  canSubmitInspection,
  canUpdateInspectionAnswers,
  canViewOrderChecklist,
} from './inspection.access.js';
import {
  mergeChecklistAnswers,
  validateAnswerValueForQuestion,
  validateSubmittedAnswers,
} from './inspection.answer-validation.js';

const findOrderForInspection = async (orderId: string): Promise<OrderDocument> => {
  const order = await orderRepository.findByOrderId(orderId);

  if (!order) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  return order;
};

const findOrderChecklistForOrder = async (orderId: string): Promise<OrderChecklistDocument> => {
  const orderChecklist = await orderChecklistRepository.findByOrderId(orderId);

  if (!orderChecklist) {
    throw new AppError(
      'Order checklist not found',
      HttpStatus.NOT_FOUND,
      ErrorCode.ORDER_CHECKLIST_NOT_FOUND,
    );
  }

  return orderChecklist;
};

const assertInspectionInProgress = (order: OrderDocument): void => {
  if (order.status !== OrderStatus.INSPECTION_IN_PROGRESS) {
    throw new AppError(
      'Inspection is not in progress for this order',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INSPECTION_NOT_IN_PROGRESS,
    );
  }
};

const validateIncomingAnswers = (
  orderChecklist: OrderChecklistDocument,
  incomingAnswers: OrderChecklistAnswer[],
): void => {
  const questionMap = new Map(
    orderChecklist.questionsSnapshot.map((question) => [question.id, question]),
  );

  for (const answer of incomingAnswers) {
    const question = questionMap.get(answer.questionId);

    if (!question) {
      throw new AppError(
        `Question "${answer.questionId}" does not exist on this checklist`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_CHECKLIST_ANSWER,
      );
    }

    const validationError = validateAnswerValueForQuestion(question, answer.value);
    if (validationError) {
      throw new AppError(validationError, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_CHECKLIST_ANSWER);
    }
  }
};

const validateFileAnswersBelongToOrder = async (
  orderId: string,
  answers: OrderChecklistAnswer[],
): Promise<void> => {
  for (const answer of answers) {
    if (
      typeof answer.value !== 'object' ||
      answer.value === null ||
      !('fileId' in answer.value)
    ) {
      continue;
    }

    const fileId = (answer.value as { fileId: string }).fileId;
    const file = await fileRepository.findById(fileId);

    if (!file || file.orderId !== orderId || file.questionId !== answer.questionId) {
      throw new AppError(
        `File "${fileId}" is not valid for question "${answer.questionId}"`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.FILE_NOT_FOUND,
      );
    }
  }
};

export const getOrderChecklist = async (
  actor: AuthUser,
  orderId: string,
): Promise<OrderChecklistResponse> => {
  const order = await findOrderForInspection(orderId);

  if (!canViewOrderChecklist(actor, order)) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  const orderChecklist = await findOrderChecklistForOrder(orderId);

  return orderChecklistRepository.toOrderChecklistResponse(orderChecklist);
};

export const updateChecklistAnswers = async (
  actor: AuthUser,
  orderId: string,
  incomingAnswers: OrderChecklistAnswer[],
): Promise<OrderChecklistResponse> => {
  const order = await findOrderForInspection(orderId);

  if (!canUpdateInspectionAnswers(actor, order)) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  assertInspectionInProgress(order);

  const orderChecklist = await findOrderChecklistForOrder(orderId);
  validateIncomingAnswers(orderChecklist, incomingAnswers);
  await validateFileAnswersBelongToOrder(orderId, incomingAnswers);

  const mergedAnswers = mergeChecklistAnswers(
    orderChecklist.answers as OrderChecklistAnswer[],
    incomingAnswers,
  );

  const updatedChecklist = await orderChecklistRepository.saveAnswers(orderId, mergedAnswers);

  if (!updatedChecklist) {
    throw new AppError(
      'Order checklist not found',
      HttpStatus.NOT_FOUND,
      ErrorCode.ORDER_CHECKLIST_NOT_FOUND,
    );
  }

  return orderChecklistRepository.toOrderChecklistResponse(updatedChecklist);
};

export const submitInspection = async (
  actor: AuthUser,
  orderId: string,
): Promise<OrderChecklistResponse> => {
  const order = await findOrderForInspection(orderId);

  if (!canSubmitInspection(actor, order)) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  assertInspectionInProgress(order);

  const orderChecklist = await findOrderChecklistForOrder(orderId);
  const answers = orderChecklist.answers as OrderChecklistAnswer[];

  const validationError = validateSubmittedAnswers(orderChecklist.questionsSnapshot, answers);
  if (validationError) {
    throw new AppError(validationError, HttpStatus.BAD_REQUEST, ErrorCode.INVALID_CHECKLIST_ANSWER);
  }

  await validateFileAnswersBelongToOrder(orderId, answers);

  assertValidTransition(order, OrderStatus.INSPECTION_COMPLETED);

  const updatedOrder = await orderRepository.updateStatus(orderId, OrderStatus.INSPECTION_COMPLETED);

  if (!updatedOrder) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  return orderChecklistRepository.toOrderChecklistResponse(orderChecklist);
};
