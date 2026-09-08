import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { HttpStatus } from '../common/constants/http-status.js';
import { AppError } from '../common/errors/app-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { errorResponse } from '../common/types/api-response.js';
import { logger } from '../common/utils/logger.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res
    .status(HttpStatus.NOT_FOUND)
    .json(errorResponse(`Route ${req.method} ${req.originalUrl} not found`, ErrorCode.NOT_FOUND));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res
      .status(HttpStatus.BAD_REQUEST)
      .json(errorResponse('Validation failed', ErrorCode.VALIDATION_ERROR, err.issues));
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message, err.code, err.errors));
    return;
  }

  logger.error('Unhandled error', {
    message: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined,
  });

  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Unknown error';

  res
    .status(HttpStatus.INTERNAL_SERVER_ERROR)
    .json(errorResponse(message, ErrorCode.INTERNAL_ERROR));
};
