import type { Request, Response } from 'express';

import { UserRole } from '../../common/constants/roles.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { successResponse } from '../../common/types/api-response.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import * as userService from './user.service.js';
import type {
  CreateUserByAdminBody,
  CreateUserByProcurementManagerBody,
} from './user.validation.js';

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }

  const user =
    req.user.role === UserRole.ADMIN
      ? await userService.createUserByAdmin(req.user.id, req.body as CreateUserByAdminBody)
      : req.user.role === UserRole.PROCUREMENT_MANAGER
        ? await userService.createUserByProcurementManager(
            req.user.id,
            req.body as CreateUserByProcurementManagerBody,
          )
        : null;

  if (!user) {
    throw new AppError('Insufficient permissions', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }

  res.status(HttpStatus.CREATED).json(successResponse(user, 'User created successfully'));
});
