import type { Request, Response } from 'express';

import { HttpStatus } from '../../common/constants/http-status.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { successResponse } from '../../common/types/api-response.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import * as fileService from './file.service.js';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }

  return req.user;
};

export const uploadChecklistFile = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { orderId, questionId } = res.locals.validatedParams as {
    orderId: string;
    questionId: string;
  };

  if (!req.file) {
    throw new AppError('File is required', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
  }

  const file = await fileService.uploadChecklistFile({
    actor,
    orderId,
    questionId,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    buffer: req.file.buffer,
  });

  res.status(HttpStatus.CREATED).json(successResponse(file, 'File uploaded successfully'));
});

export const downloadFile = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { fileId } = res.locals.validatedParams as { fileId: string };
  const { file, stream } = await fileService.openStoredFileStream(actor, fileId);

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
  stream.pipe(res);
});
