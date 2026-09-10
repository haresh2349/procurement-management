import { Router } from 'express';

import { UserRole } from '../../common/constants/roles.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { fileIdParamSchema } from '../inspections/inspection.validation.js';
import * as fileController from './file.controller.js';

const fileReadRoles = [
  UserRole.ADMIN,
  UserRole.PROCUREMENT_MANAGER,
  UserRole.INSPECTION_MANAGER,
  UserRole.CLIENT,
] as const;

export const fileRouter = Router();

fileRouter.get(
  '/:fileId',
  authenticate,
  authorize(...fileReadRoles),
  validate(fileIdParamSchema, 'params'),
  fileController.downloadFile,
);
