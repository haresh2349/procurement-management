import { z } from 'zod';

import { ORDER_ID_PATTERN, OrderStatus } from './order.constants.js';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const businessOrderIdSchema = z.string().regex(ORDER_ID_PATTERN, 'Invalid order id');

export const createOrderSchema = z.object({
  clientId: objectIdSchema,
  inspectionManagerId: objectIdSchema.optional(),
});

export const orderIdParamSchema = z.object({
  orderId: businessOrderIdSchema,
});

export const listOrdersQuerySchema = z.object({
  status: z
    .enum([
      OrderStatus.CREATED,
      OrderStatus.INSPECTION_IN_PROGRESS,
      OrderStatus.INSPECTION_COMPLETED,
      OrderStatus.APPROVED,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
    ])
    .optional(),
  clientId: objectIdSchema.optional(),
  inspectionManagerId: objectIdSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const assignInspectionManagerSchema = z.object({
  inspectionManagerId: objectIdSchema,
});

export const attachChecklistSchema = z.object({
  checklistTemplateId: objectIdSchema,
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    OrderStatus.INSPECTION_IN_PROGRESS,
    OrderStatus.INSPECTION_COMPLETED,
    OrderStatus.APPROVED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ]),
});

export type CreateOrderBody = z.infer<typeof createOrderSchema>;
export type ListOrdersQueryInput = z.infer<typeof listOrdersQuerySchema>;
export type AssignInspectionManagerBody = z.infer<typeof assignInspectionManagerSchema>;
export type AttachChecklistBody = z.infer<typeof attachChecklistSchema>;
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusSchema>;
