import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { comparePassword } from '../../common/utils/password.js';
import { signAccessToken } from '../../common/utils/jwt.js';
import * as userRepository from '../users/user.repository.js';
import type { UserResponse } from '../users/user.types.js';
import type { LoginBody } from './auth.validation.js';

export interface LoginResult {
  accessToken: string;
  user: UserResponse;
}

export const login = async (input: LoginBody): Promise<LoginResult> => {
  const user = input.email
    ? await userRepository.findByEmailWithPassword(input.email)
    : await userRepository.findByMobileWithPassword(input.mobile!);

  if (!user) {
    throw new AppError('Invalid credentials', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }

  if (!user.isActive) {
    throw new AppError('Account is inactive', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }

  const isPasswordValid = await comparePassword(input.password, user.password);

  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
  });

  return {
    accessToken,
    user: userRepository.toUserResponse(user),
  };
};
