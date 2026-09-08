import { Router } from 'express';

import { validate } from '../../middlewares/validate.middleware.js';
import * as authController from './auth.controller.js';
import { loginSchema } from './auth.validation.js';

export const authRouter = Router();

authRouter.post('/login', validate(loginSchema), authController.login);
