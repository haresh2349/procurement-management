import mongoose from 'mongoose';

import { ADMIN_CREATABLE_ROLES, UserRole } from '../../common/constants/roles.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { hashPassword } from '../../common/utils/password.js';
import * as userRepository from './user.repository.js';
import type { CreateUserInput, UserResponse } from './user.types.js';

const isDuplicateKeyError = (error: unknown): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
};

const validateManagerAssignment = async (managerId?: string): Promise<void> => {
  if (!managerId) {
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(managerId)) {
    throw new AppError('Invalid managerId', HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST);
  }

  const manager = await userRepository.findById(managerId);

  if (!manager) {
    throw new AppError('Manager not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  if (manager.role !== UserRole.PROCUREMENT_MANAGER) {
    throw new AppError(
      'managerId must reference a Procurement Manager',
      HttpStatus.BAD_REQUEST,
      ErrorCode.BAD_REQUEST,
    );
  }
};

export const createUserByAdmin = async (
  adminId: string,
  input: CreateUserInput,
): Promise<UserResponse> => {
  if (!ADMIN_CREATABLE_ROLES.includes(input.role)) {
    throw new AppError(
      'Admin cannot create users with this role',
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN,
    );
  }

  if (input.role !== UserRole.INSPECTION_MANAGER && input.managerId) {
    throw new AppError(
      'managerId is only allowed for Inspection Manager',
      HttpStatus.BAD_REQUEST,
      ErrorCode.BAD_REQUEST,
    );
  }

  await validateManagerAssignment(input.managerId);

  if (input.email) {
    const existingEmail = await userRepository.findByEmail(input.email);

    if (existingEmail) {
      throw new AppError('Email already in use', HttpStatus.CONFLICT, ErrorCode.CONFLICT);
    }
  }

  if (input.mobile) {
    const existingMobile = await userRepository.findByMobile(input.mobile);

    if (existingMobile) {
      throw new AppError('Mobile already in use', HttpStatus.CONFLICT, ErrorCode.CONFLICT);
    }
  }

  try {
    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.createUser({
      ...input,
      passwordHash,
      createdBy: adminId,
    });

    return userRepository.toUserResponse(user);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError('User already exists', HttpStatus.CONFLICT, ErrorCode.CONFLICT);
    }

    throw error;
  }
};
