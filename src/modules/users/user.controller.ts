import type { Request, Response } from 'express';

import { HttpStatus } from '../../common/constants/http-status.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { successResponse } from '../../common/types/api-response.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import * as userService from './user.service.js';
import type { CreateUserBody } from './user.validation.js';

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }

  const body = req.body as CreateUserBody;
  const user = await userService.createUserByAdmin(req.user.id, body);

  res.status(HttpStatus.CREATED).json(successResponse(user, 'User created successfully'));
});
