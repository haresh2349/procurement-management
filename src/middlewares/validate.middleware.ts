import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

import { AppError } from '../common/errors/app-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { HttpStatus } from '../common/constants/http-status.js';

type RequestSource = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodType, source: RequestSource = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(
        new AppError(
          'Validation failed',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
          result.error.issues,
        ),
      );
      return;
    }

    req[source] = result.data;
    next();
  };
