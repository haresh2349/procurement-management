import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler, notFoundHandler } from './middlewares/error-handler.middleware.js';
import { authRouter } from './modules/auth/auth.route.js';
import { checklistTemplateRouter } from './modules/checklist-templates/checklist-template.route.js';
import { fileRouter } from './modules/files/file.route.js';
import { orderRouter } from './modules/orders/order.route.js';
import { userRouter } from './modules/users/user.route.js';
import { healthRouter } from './routes/health.route.js';

export const createApp = (): Express => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/checklist-templates', checklistTemplateRouter);
  app.use('/api/v1/orders', orderRouter);
  app.use('/api/v1/files', fileRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
