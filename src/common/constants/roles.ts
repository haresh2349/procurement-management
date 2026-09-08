export const UserRole = {
  ADMIN: 'ADMIN',
  PROCUREMENT_MANAGER: 'PROCUREMENT_MANAGER',
  INSPECTION_MANAGER: 'INSPECTION_MANAGER',
  CLIENT: 'CLIENT',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const ADMIN_CREATABLE_ROLES: UserRoleType[] = [
  UserRole.PROCUREMENT_MANAGER,
  UserRole.INSPECTION_MANAGER,
  UserRole.CLIENT,
];

export const PROCUREMENT_MANAGER_CREATABLE_ROLES: UserRoleType[] = [
  UserRole.INSPECTION_MANAGER,
  UserRole.CLIENT,
];
