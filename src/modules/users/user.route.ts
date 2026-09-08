import { Router } from 'express';

import { UserRole } from '../../common/constants/roles.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import * as userController from './user.controller.js';
import { validateCreateUserRequest } from './user.middleware.js';

export const userRouter = Router();

userRouter.post(
  '/',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER),
  validateCreateUserRequest,
  userController.createUser,
);
