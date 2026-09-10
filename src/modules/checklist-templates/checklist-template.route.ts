import { Router } from 'express';

import { UserRole } from '../../common/constants/roles.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import * as checklistTemplateController from './checklist-template.controller.js';
import {
  checklistTemplateIdParamSchema,
  createChecklistTemplateSchema,
  listChecklistTemplatesQuerySchema,
  updateChecklistTemplateSchema,
} from './checklist-template.schemas.js';

const checklistTemplateRoles = [UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER] as const;

export const checklistTemplateRouter = Router();

checklistTemplateRouter.get(
  '/',
  authenticate,
  authorize(...checklistTemplateRoles),
  validate(listChecklistTemplatesQuerySchema, 'query'),
  checklistTemplateController.listChecklistTemplates,
);

checklistTemplateRouter.get(
  '/:id',
  authenticate,
  authorize(...checklistTemplateRoles),
  validate(checklistTemplateIdParamSchema, 'params'),
  checklistTemplateController.getChecklistTemplateById,
);

checklistTemplateRouter.post(
  '/',
  authenticate,
  authorize(...checklistTemplateRoles),
  validate(createChecklistTemplateSchema),
  checklistTemplateController.createChecklistTemplate,
);

checklistTemplateRouter.patch(
  '/:id',
  authenticate,
  authorize(...checklistTemplateRoles),
  validate(checklistTemplateIdParamSchema, 'params'),
  validate(updateChecklistTemplateSchema),
  checklistTemplateController.updateChecklistTemplate,
);
