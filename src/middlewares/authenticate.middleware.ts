import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../common/errors/app-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { HttpStatus } from '../common/constants/http-status.js';
import { verifyAccessToken } from '../common/utils/jwt.js';
import * as userRepository from '../modules/users/user.repository.js';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED,
      );
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    const user = await userRepository.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new AppError(
        'Invalid or inactive user',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED,
      );
    }

    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      mobile: user.mobile,
      name: user.name,
    };

    next();
  } catch (error) {
    next(error);
  }
};
