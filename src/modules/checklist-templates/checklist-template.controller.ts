import type { Request, Response } from 'express';

import { HttpStatus } from '../../common/constants/http-status.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { successResponse } from '../../common/types/api-response.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import * as checklistTemplateService from './checklist-template.service.js';
import type {
  CreateChecklistTemplateBody,
  ListChecklistTemplatesQueryInput,
  UpdateChecklistTemplateBody,
} from './checklist-template.schemas.js';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }

  return req.user;
};

export const createChecklistTemplate = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const template = await checklistTemplateService.createChecklistTemplate(
    actor,
    req.body as CreateChecklistTemplateBody,
  );

  res
    .status(HttpStatus.CREATED)
    .json(successResponse(template, 'Checklist template created successfully'));
});

export const listChecklistTemplates = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const query = res.locals.validatedQuery as ListChecklistTemplatesQueryInput;
  const templates = await checklistTemplateService.listChecklistTemplates(actor, query);

  res
    .status(HttpStatus.OK)
    .json(successResponse(templates, 'Checklist templates retrieved successfully'));
});

export const getChecklistTemplateById = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { id } = res.locals.validatedParams as { id: string };
  const template = await checklistTemplateService.getChecklistTemplateById(actor, id);

  res
    .status(HttpStatus.OK)
    .json(successResponse(template, 'Checklist template retrieved successfully'));
});

export const updateChecklistTemplate = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { id } = res.locals.validatedParams as { id: string };
  const template = await checklistTemplateService.updateChecklistTemplate(
    actor,
    id,
    req.body as UpdateChecklistTemplateBody,
  );

  res
    .status(HttpStatus.OK)
    .json(successResponse(template, 'Checklist template updated successfully'));
});
