import mongoose from 'mongoose';

import { UserRole } from '../../common/constants/roles.js';
import type { AuthUser } from '../../common/types/express.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import * as userRepository from '../users/user.repository.js';
import {
  buildListChecklistTemplatesFilter,
  canAccessChecklistTemplate,
} from './checklist-template.access.js';
import type { ChecklistTemplateDocument } from './checklist-template.model.js';
import * as checklistTemplateRepository from './checklist-template.repository.js';
import type {
  ChecklistTemplateResponse,
  CreateChecklistTemplateInput,
  ListChecklistTemplatesQuery,
  PaginatedChecklistTemplatesResponse,
  UpdateChecklistTemplateInput,
} from './checklist-template.types.js';
import { validateChecklistQuestions } from './checklist-template.validation.js';
import {
  assignQuestionIds,
  mergeQuestionsOnUpdate,
  serializeQuestionsForVersionCheck,
} from './checklist-template.utils.js';

const validateClientForChecklistTemplate = async (
  actor: AuthUser,
  clientId: string,
): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    throw new AppError('Client not found', HttpStatus.NOT_FOUND, ErrorCode.CLIENT_NOT_FOUND);
  }

  const client = await userRepository.findById(clientId);

  if (!client) {
    throw new AppError('Client not found', HttpStatus.NOT_FOUND, ErrorCode.CLIENT_NOT_FOUND);
  }

  if (client.role !== UserRole.CLIENT) {
    throw new AppError(
      'User must have CLIENT role',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_CLIENT_ROLE,
    );
  }

  if (!client.isActive) {
    throw new AppError('Client is inactive', HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST);
  }

  if (actor.role === UserRole.PROCUREMENT_MANAGER && client.createdBy?.toString() !== actor.id) {
    throw new AppError('Client not found', HttpStatus.NOT_FOUND, ErrorCode.CLIENT_NOT_FOUND);
  }
};

const assertValidQuestions = (questions: Parameters<typeof validateChecklistQuestions>[0]): void => {
  const validationError = validateChecklistQuestions(questions);

  if (validationError) {
    throw new AppError(validationError, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
  }
};

const findChecklistTemplateById = async (templateId: string): Promise<ChecklistTemplateDocument> => {
  if (!mongoose.Types.ObjectId.isValid(templateId)) {
    throw new AppError('Checklist not found', HttpStatus.NOT_FOUND, ErrorCode.CHECKLIST_NOT_FOUND);
  }

  const template = await checklistTemplateRepository.findById(templateId);

  if (!template) {
    throw new AppError('Checklist not found', HttpStatus.NOT_FOUND, ErrorCode.CHECKLIST_NOT_FOUND);
  }

  return template;
};

const applyDefaultFlag = async (
  clientId: string,
  templateId: string,
  isDefault: boolean,
): Promise<void> => {
  if (!isDefault) {
    return;
  }

  await checklistTemplateRepository.unsetDefaultForClient(clientId, templateId);
};

export const createChecklistTemplate = async (
  actor: AuthUser,
  input: CreateChecklistTemplateInput,
): Promise<ChecklistTemplateResponse> => {
  await validateClientForChecklistTemplate(actor, input.clientId);

  const questions = assignQuestionIds(input.questions);
  assertValidQuestions(questions);

  const template = await checklistTemplateRepository.create({
    name: input.name,
    clientId: input.clientId,
    createdBy: actor.id,
    isDefault: input.isDefault ?? false,
    questions,
  });

  if (template.isDefault) {
    await applyDefaultFlag(template.clientId.toString(), template._id.toString(), true);
  }

  return checklistTemplateRepository.toChecklistTemplateResponse(template);
};

export const listChecklistTemplates = async (
  actor: AuthUser,
  query: ListChecklistTemplatesQuery,
): Promise<PaginatedChecklistTemplatesResponse> => {
  const filter = buildListChecklistTemplatesFilter(actor, { clientId: query.clientId });

  if (!filter) {
    throw new AppError('Insufficient permissions', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }

  const { templates, total } = await checklistTemplateRepository.findPaginated(
    filter,
    query.page,
    query.limit,
  );

  return {
    items: templates.map(checklistTemplateRepository.toChecklistTemplateResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};

export const getChecklistTemplateById = async (
  actor: AuthUser,
  templateId: string,
): Promise<ChecklistTemplateResponse> => {
  const template = await findChecklistTemplateById(templateId);

  if (!canAccessChecklistTemplate(actor, template)) {
    throw new AppError('Checklist not found', HttpStatus.NOT_FOUND, ErrorCode.CHECKLIST_NOT_FOUND);
  }

  return checklistTemplateRepository.toChecklistTemplateResponse(template);
};

export const updateChecklistTemplate = async (
  actor: AuthUser,
  templateId: string,
  input: UpdateChecklistTemplateInput,
): Promise<ChecklistTemplateResponse> => {
  const template = await findChecklistTemplateById(templateId);

  if (!canAccessChecklistTemplate(actor, template)) {
    throw new AppError('Checklist not found', HttpStatus.NOT_FOUND, ErrorCode.CHECKLIST_NOT_FOUND);
  }

  const updatePayload: {
    name?: string;
    isDefault?: boolean;
    version?: number;
    questions?: ChecklistTemplateDocument['questions'];
  } = {};

  if (input.name !== undefined) {
    updatePayload.name = input.name;
  }

  if (input.isDefault !== undefined) {
    updatePayload.isDefault = input.isDefault;
  }

  if (input.questions) {
    let mergedQuestions;

    try {
      mergedQuestions = mergeQuestionsOnUpdate(template.questions, input.questions);
    } catch (error) {
      throw new AppError(
        error instanceof Error ? error.message : 'Invalid checklist questions',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    assertValidQuestions(mergedQuestions);

    const hasQuestionChanges =
      serializeQuestionsForVersionCheck(template.questions) !==
      serializeQuestionsForVersionCheck(mergedQuestions);

    updatePayload.questions = mergedQuestions;

    if (hasQuestionChanges) {
      updatePayload.version = template.version + 1;
    }
  }

  const updatedTemplate = await checklistTemplateRepository.updateById(templateId, updatePayload);

  if (!updatedTemplate) {
    throw new AppError('Checklist not found', HttpStatus.NOT_FOUND, ErrorCode.CHECKLIST_NOT_FOUND);
  }

  if (input.isDefault === true) {
    await applyDefaultFlag(
      updatedTemplate.clientId.toString(),
      updatedTemplate._id.toString(),
      true,
    );
  }

  const refreshedTemplate = await checklistTemplateRepository.findById(templateId);

  if (!refreshedTemplate) {
    throw new AppError('Checklist not found', HttpStatus.NOT_FOUND, ErrorCode.CHECKLIST_NOT_FOUND);
  }

  return checklistTemplateRepository.toChecklistTemplateResponse(refreshedTemplate);
};
