import { Router } from 'express';

import { UserRole } from '../../common/constants/roles.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import * as userController from './user.controller.js';
import { createUserSchema } from './user.validation.js';

export const userRouter = Router();

userRouter.post(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  validate(createUserSchema),
  userController.createUser,
);
