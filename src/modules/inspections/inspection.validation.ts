import { z } from 'zod';

import { ORDER_ID_PATTERN } from '../orders/order.constants.js';

const questionIdSchema = z.string().trim().min(1, 'Invalid question id');

export const orderChecklistParamsSchema = z.object({
  orderId: z.string().regex(ORDER_ID_PATTERN, 'Invalid order id'),
});

export const orderChecklistQuestionParamsSchema = z.object({
  orderId: z.string().regex(ORDER_ID_PATTERN, 'Invalid order id'),
  questionId: questionIdSchema,
});

export const updateChecklistAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: questionIdSchema,
        value: z.unknown(),
      }),
    )
    .min(1, 'At least one answer is required'),
});

export const fileIdParamSchema = z.object({
  fileId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid file id'),
});

export type UpdateChecklistAnswersBody = z.infer<typeof updateChecklistAnswersSchema>;
