import { z } from 'zod';

import { QuestionType } from './checklist-template.constants.js';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const questionTypeSchema = z.enum([
  QuestionType.BOOLEAN,
  QuestionType.SINGLE_SELECT,
  QuestionType.MULTI_SELECT,
  QuestionType.TEXT,
  QuestionType.FILE,
]);

const createQuestionSchema = z.object({
  label: z.string().trim().min(1, 'Question label is required'),
  type: questionTypeSchema,
  required: z.boolean(),
  order: z.number().int().min(0),
  options: z.array(z.string().trim().min(1)).optional(),
});

const updateQuestionSchema = createQuestionSchema.extend({
  id: z.string().trim().min(1).optional(),
});

export const checklistTemplateIdParamSchema = z.object({
  id: objectIdSchema,
});

export const listChecklistTemplatesQuerySchema = z.object({
  clientId: objectIdSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createChecklistTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  clientId: objectIdSchema,
  isDefault: z.boolean().optional().default(false),
  questions: z.array(createQuestionSchema).min(1, 'At least one question is required'),
});

export const updateChecklistTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    isDefault: z.boolean().optional(),
    questions: z.array(updateQuestionSchema).min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateChecklistTemplateBody = z.infer<typeof createChecklistTemplateSchema>;
export type UpdateChecklistTemplateBody = z.infer<typeof updateChecklistTemplateSchema>;
export type ListChecklistTemplatesQueryInput = z.infer<typeof listChecklistTemplatesQuerySchema>;
