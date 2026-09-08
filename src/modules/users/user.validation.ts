import { z } from 'zod';

import { UserRole } from '../../common/constants/roles.js';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid managerId');

export const createUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum([UserRole.PROCUREMENT_MANAGER, UserRole.INSPECTION_MANAGER, UserRole.CLIENT]),
    email: z.email().optional(),
    mobile: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{10,15}$/, 'Mobile must be 10-15 digits')
      .optional(),
    managerId: objectIdSchema.optional(),
  })
  .superRefine((data, ctx) => {
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
  });

export type CreateUserBody = z.infer<typeof createUserSchema>;
