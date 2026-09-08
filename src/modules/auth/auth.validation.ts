import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.email().optional(),
    mobile: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{10,15}$/, 'Mobile must be 10-15 digits')
      .optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.mobile) {
      ctx.addIssue({
        code: 'custom',
        message: 'Either email or mobile is required',
        path: ['email'],
      });
    }

    if (data.email && data.mobile) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide either email or mobile, not both',
        path: ['email'],
      });
    }
  });

export type LoginBody = z.infer<typeof loginSchema>;
