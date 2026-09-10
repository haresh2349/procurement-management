import type { AuthUser } from '../../common/types/express.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { QuestionType } from '../checklist-templates/checklist-template.constants.js';
import {
  canUpdateInspectionAnswers,
  canViewOrderChecklist,
} from '../inspections/inspection.access.js';
import { mergeChecklistAnswers } from '../inspections/inspection.answer-validation.js';
import type { OrderChecklistAnswer } from '../orders/order-checklist.answer-types.js';
import * as orderChecklistRepository from '../orders/order-checklist.repository.js';
import * as orderRepository from '../orders/order.repository.js';
import * as fileRepository from './file.repository.js';
import * as fileStorage from './file.storage.js';
import type { FileResponse } from './file.types.js';
export const uploadChecklistFile = async (input: {
  actor: AuthUser;
  orderId: string;
  questionId: string;
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}): Promise<FileResponse> => {
  const order = await orderRepository.findByOrderId(input.orderId);

  if (!order) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  if (!canUpdateInspectionAnswers(input.actor, order)) {
    throw new AppError('Order not found', HttpStatus.NOT_FOUND, ErrorCode.ORDER_NOT_FOUND);
  }

  const orderChecklist = await orderChecklistRepository.findByOrderId(input.orderId);

  if (!orderChecklist) {
    throw new AppError(
      'Order checklist not found',
      HttpStatus.NOT_FOUND,
      ErrorCode.ORDER_CHECKLIST_NOT_FOUND,
    );
  }

  const question = orderChecklist.questionsSnapshot.find(
    (snapshot) => snapshot.id === input.questionId,
  );

  if (!question) {
    throw new AppError(
      `Question "${input.questionId}" does not exist on this checklist`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_CHECKLIST_ANSWER,
    );
  }

  if (question.type !== QuestionType.FILE) {
    throw new AppError(
      `Question "${input.questionId}" does not accept file uploads`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_CHECKLIST_ANSWER,
    );
  }

  const storedFile = await fileStorage.saveUploadedFile({
    orderId: input.orderId,
    questionId: input.questionId,
    originalName: input.originalName,
    buffer: input.buffer,
  });

  const fileRecord = await fileRepository.create({
    orderId: input.orderId,
    orderChecklistId: orderChecklist._id.toString(),
    questionId: input.questionId,
    originalName: input.originalName,
    storagePath: storedFile.storagePath,
    mimeType: input.mimeType,
    size: input.size,
    uploadedBy: input.actor.id,
  });

  const fileAnswer: OrderChecklistAnswer = {
    questionId: input.questionId,
    value: {
      fileId: fileRecord._id.toString(),
      originalName: fileRecord.originalName,
      mimeType: fileRecord.mimeType,
      size: fileRecord.size,
    },
  };

  const mergedAnswers = mergeChecklistAnswers(
    orderChecklist.answers as OrderChecklistAnswer[],
    [fileAnswer],
  );

  await orderChecklistRepository.saveAnswers(input.orderId, mergedAnswers);

  return fileRepository.toFileResponse(fileRecord);
};

export const getFileById = async (actor: AuthUser, fileId: string): Promise<FileResponse> => {
  const file = await fileRepository.findById(fileId);

  if (!file) {
    throw new AppError('File not found', HttpStatus.NOT_FOUND, ErrorCode.FILE_NOT_FOUND);
  }

  const order = await orderRepository.findByOrderId(file.orderId);

  if (!order || !canViewOrderChecklist(actor, order)) {
    throw new AppError('File not found', HttpStatus.NOT_FOUND, ErrorCode.FILE_NOT_FOUND);
  }

  return fileRepository.toFileResponse(file);
};

export const openStoredFileStream = async (actor: AuthUser, fileId: string) => {
  const file = await fileRepository.findById(fileId);

  if (!file) {
    throw new AppError('File not found', HttpStatus.NOT_FOUND, ErrorCode.FILE_NOT_FOUND);
  }

  const order = await orderRepository.findByOrderId(file.orderId);

  if (!order || !canViewOrderChecklist(actor, order)) {
    throw new AppError('File not found', HttpStatus.NOT_FOUND, ErrorCode.FILE_NOT_FOUND);
  }

  return {
    file,
    stream: fileStorage.openFileReadStream(file.storagePath),
  };
};
