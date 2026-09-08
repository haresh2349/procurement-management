import type { Request, Response } from 'express';

import { HttpStatus } from '../../common/constants/http-status.js';
import { successResponse } from '../../common/types/api-response.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import * as authService from './auth.service.js';
import type { LoginBody } from './auth.validation.js';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LoginBody;
  const result = await authService.login(body);

  res.status(HttpStatus.OK).json(successResponse(result, 'Login successful'));
});
