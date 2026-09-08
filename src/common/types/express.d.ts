import type { UserRoleType } from '../constants/roles.js';

export interface AuthUser {
  id: string;
  role: UserRoleType;
  email?: string;
  mobile?: string;
  name: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }

  interface Locals {
    validatedQuery?: unknown;
    validatedParams?: unknown;
  }
}
