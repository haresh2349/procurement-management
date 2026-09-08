import { Router } from 'express';

import { UserRole } from '../../common/constants/roles.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import * as userController from './user.controller.js';
import { validateCreateUserRequest } from './user.middleware.js';
import {
  assignInspectionManagerSchema,
  inspectionManagerIdParamSchema,
  listUsersQuerySchema,
  userIdParamSchema,
} from './user.validation.js';

export const userRouter = Router();

userRouter.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER),
  validate(listUsersQuerySchema, 'query'),
  userController.listUsers,
);

userRouter.get(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER),
  validate(userIdParamSchema, 'params'),
  userController.getUserById,
);

userRouter.post(
  '/',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER),
  validateCreateUserRequest,
  userController.createUser,
);

userRouter.patch(
  '/:inspectionManagerId/assign',
  authenticate,
  authorize(UserRole.ADMIN),
  validate(inspectionManagerIdParamSchema, 'params'),
  validate(assignInspectionManagerSchema),
  userController.assignInspectionManager,
);

userRouter.patch(
  '/:inspectionManagerId/unassign',
  authenticate,
  authorize(UserRole.ADMIN),
  validate(inspectionManagerIdParamSchema, 'params'),
  userController.unassignInspectionManager,
);
