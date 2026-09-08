import { z } from 'zod';

import { UserRole } from '../../common/constants/roles.js';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid managerId');

const baseCreateUserFields = {
  name: z.string().trim().min(1, 'Name is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  email: z.email().optional(),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, 'Mobile must be 10-15 digits')
    .optional(),
};

const requireContactDetails = (
  data: { role: string; email?: string; mobile?: string },
  ctx: z.RefinementCtx,
): void => {
  if (data.role === UserRole.INSPECTION_MANAGER) {
    if (!data.mobile) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mobile is required for Inspection Manager',
        path: ['mobile'],
      });
    }
  } else if (!data.email) {
    ctx.addIssue({
      code: 'custom',
      message: 'Email is required for this role',
      path: ['email'],
    });
  }
};

export const createUserByAdminSchema = z
  .object({
    ...baseCreateUserFields,
    role: z.enum([UserRole.PROCUREMENT_MANAGER, UserRole.INSPECTION_MANAGER, UserRole.CLIENT]),
    managerId: objectIdSchema.optional(),
  })
  .superRefine(requireContactDetails);

export const createUserByProcurementManagerSchema = z
  .object({
    ...baseCreateUserFields,
    role: z.enum([UserRole.INSPECTION_MANAGER, UserRole.CLIENT]),
  })
  .strict()
  .superRefine(requireContactDetails);

export type CreateUserByAdminBody = z.infer<typeof createUserByAdminSchema>;
export type CreateUserByProcurementManagerBody = z.infer<
  typeof createUserByProcurementManagerSchema
>;

// Backward-compatible alias used by existing tests/imports
export const createUserSchema = createUserByAdminSchema;
export type CreateUserBody = CreateUserByAdminBody;
