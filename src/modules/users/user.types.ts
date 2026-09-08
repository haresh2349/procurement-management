import type { UserRoleType } from '../../common/constants/roles.js';

export interface UserResponse {
  id: string;
  name: string;
  email?: string;
  mobile?: string;
  role: UserRoleType;
  managerId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  name: string;
  password: string;
  role: UserRoleType;
  email?: string;
  mobile?: string;
  managerId?: string;
}

export interface CreateUserPersistenceInput extends CreateUserInput {
  createdBy: string;
  passwordHash: string;
}
