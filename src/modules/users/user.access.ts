import mongoose from 'mongoose';

import type { AuthUser } from '../../common/types/express.js';
import { UserRole } from '../../common/constants/roles.js';
import type { ListUsersQuery } from './user.types.js';
import type { UserDocument } from './user.model.js';

export const ADMIN_LISTABLE_ROLES = [
  UserRole.PROCUREMENT_MANAGER,
  UserRole.INSPECTION_MANAGER,
  UserRole.CLIENT,
] as const;

export const canViewUser = (actor: AuthUser, target: UserDocument): boolean => {
  if (actor.role === UserRole.ADMIN) {
    return ADMIN_LISTABLE_ROLES.includes(target.role as (typeof ADMIN_LISTABLE_ROLES)[number]);
  }

  if (actor.role === UserRole.PROCUREMENT_MANAGER) {
    if (target.role === UserRole.CLIENT) {
      return target.createdBy?.toString() === actor.id;
    }

    if (target.role === UserRole.INSPECTION_MANAGER) {
      return target.managerId?.toString() === actor.id;
    }
  }

  return false;
};

const applyRoleFilter = (
  filter: Record<string, unknown>,
  role?: ListUsersQuery['role'],
): Record<string, unknown> => {
  if (!role) {
    return filter;
  }

  return {
    $and: [filter, { role }],
  };
};

export const buildListUsersFilter = (
  actor: AuthUser,
  query?: Pick<ListUsersQuery, 'role'>,
): Record<string, unknown> | null => {
  if (actor.role === UserRole.ADMIN) {
    return applyRoleFilter(
      {
        role: { $in: [...ADMIN_LISTABLE_ROLES] },
      },
      query?.role,
    );
  }

  if (actor.role === UserRole.PROCUREMENT_MANAGER) {
    const actorObjectId = new mongoose.Types.ObjectId(actor.id);

    return applyRoleFilter(
      {
        $or: [
          { role: UserRole.CLIENT, createdBy: actorObjectId },
          { role: UserRole.INSPECTION_MANAGER, managerId: actorObjectId },
        ],
      },
      query?.role,
    );
  }

  return null;
};
