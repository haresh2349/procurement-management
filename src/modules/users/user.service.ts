import mongoose from 'mongoose';

import {
  ADMIN_CREATABLE_ROLES,
  PROCUREMENT_MANAGER_CREATABLE_ROLES,
  UserRole,
} from '../../common/constants/roles.js';
import type { AuthUser } from '../../common/types/express.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { hashPassword } from '../../common/utils/password.js';
import { buildListUsersFilter, canViewUser } from './user.access.js';
import type { UserDocument } from './user.model.js';
import * as userRepository from './user.repository.js';
import type {
  CreateUserInput,
  ListUsersQuery,
  PaginatedUsersResponse,
  UserResponse,
} from './user.types.js';

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

const assertUniqueContactDetails = async (email?: string, mobile?: string): Promise<void> => {
  if (email) {
    const existingEmail = await userRepository.findByEmail(email);

    if (existingEmail) {
      throw new AppError('Email already in use', HttpStatus.CONFLICT, ErrorCode.CONFLICT);
    }
  }

  if (mobile) {
    const existingMobile = await userRepository.findByMobile(mobile);

    if (existingMobile) {
      throw new AppError('Mobile already in use', HttpStatus.CONFLICT, ErrorCode.CONFLICT);
    }
  }
};

const saveUser = async (createdBy: string, input: CreateUserInput): Promise<UserResponse> => {
  await assertUniqueContactDetails(input.email, input.mobile);

  try {
    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.createUser({
      ...input,
      passwordHash,
      createdBy,
    });

    return userRepository.toUserResponse(user);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError('User already exists', HttpStatus.CONFLICT, ErrorCode.CONFLICT);
    }

    throw error;
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

  return saveUser(adminId, input);
};

export const createUserByProcurementManager = async (
  procurementManagerId: string,
  input: CreateUserInput,
): Promise<UserResponse> => {
  if (!PROCUREMENT_MANAGER_CREATABLE_ROLES.includes(input.role)) {
    throw new AppError(
      'Procurement Manager cannot create users with this role',
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN,
    );
  }

  if (input.managerId) {
    throw new AppError(
      'managerId cannot be set when creating users as a Procurement Manager',
      HttpStatus.BAD_REQUEST,
      ErrorCode.BAD_REQUEST,
    );
  }

  const userInput: CreateUserInput = {
    ...input,
    managerId: input.role === UserRole.INSPECTION_MANAGER ? procurementManagerId : undefined,
  };

  return saveUser(procurementManagerId, userInput);
};

const findUserDocumentById = async (userId: string): Promise<UserDocument> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  const user = await userRepository.findById(userId);

  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  return user;
};

const findInspectionManagerById = async (inspectionManagerId: string): Promise<UserDocument> => {
  const user = await findUserDocumentById(inspectionManagerId);

  if (user.role !== UserRole.INSPECTION_MANAGER) {
    throw new AppError(
      'Only Inspection Manager users can be assigned or unassigned',
      HttpStatus.BAD_REQUEST,
      ErrorCode.BAD_REQUEST,
    );
  }

  return user;
};

export const listUsers = async (
  actor: AuthUser,
  query: ListUsersQuery,
): Promise<PaginatedUsersResponse> => {
  const filter = buildListUsersFilter(actor, query);

  if (!filter) {
    throw new AppError('Insufficient permissions', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }

  const { users, total } = await userRepository.findUsersPaginated(filter, query.page, query.limit);

  return {
    items: users.map(userRepository.toUserResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};

export const getUserById = async (actor: AuthUser, userId: string): Promise<UserResponse> => {
  const user = await findUserDocumentById(userId);

  if (!canViewUser(actor, user)) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  return userRepository.toUserResponse(user);
};

export const assignInspectionManager = async (
  inspectionManagerId: string,
  managerId: string,
): Promise<UserResponse> => {
  await findInspectionManagerById(inspectionManagerId);
  await validateManagerAssignment(managerId);

  const updatedUser = await userRepository.updateInspectionManagerManagerId(
    inspectionManagerId,
    managerId,
  );

  if (!updatedUser) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  return userRepository.toUserResponse(updatedUser);
};

export const unassignInspectionManager = async (
  inspectionManagerId: string,
): Promise<UserResponse> => {
  await findInspectionManagerById(inspectionManagerId);

  const updatedUser = await userRepository.updateInspectionManagerManagerId(
    inspectionManagerId,
    null,
  );

  if (!updatedUser) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  return userRepository.toUserResponse(updatedUser);
};
