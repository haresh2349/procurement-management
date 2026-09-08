import jwt from 'jsonwebtoken';

import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';
import { HttpStatus } from '../constants/http-status.js';
import type { UserRoleType } from '../constants/roles.js';

export interface JwtPayload {
  sub: string;
  role: UserRoleType;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new AppError(
      'JWT_SECRET environment variable is not set',
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorCode.INTERNAL_ERROR,
      undefined,
      false,
    );
  }

  return secret;
};

export const signAccessToken = (payload: JwtPayload): string => {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '7d';

  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('sub' in decoded) ||
      !('role' in decoded)
    ) {
      throw new AppError('Invalid token', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
    }

    return {
      sub: String(decoded.sub),
      role: decoded.role as UserRoleType,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('Invalid or expired token', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }
};
