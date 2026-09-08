import type { NextFunction, Request, Response } from 'express';

import { UserRole } from '../../common/constants/roles.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createUserByAdminSchema,
  createUserByProcurementManagerSchema,
} from './user.validation.js';

export const validateCreateUserRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    next(new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED));
    return;
  }

  const schema =
    req.user.role === UserRole.ADMIN
      ? createUserByAdminSchema
      : createUserByProcurementManagerSchema;

  validate(schema)(req, res, next);
};
