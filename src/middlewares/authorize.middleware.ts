import type { NextFunction, Request, Response } from 'express';

import type { UserRoleType } from '../common/constants/roles.js';
import { AppError } from '../common/errors/app-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { HttpStatus } from '../common/constants/http-status.js';

export const authorize =
  (...allowedRoles: UserRoleType[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(
        new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED),
      );
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError('Insufficient permissions', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN));
      return;
    }

    next();
  };
