import { Router } from 'express';

import { HttpStatus } from '../common/constants/http-status.js';
import { successResponse } from '../common/types/api-response.js';
import { asyncHandler } from '../common/utils/async-handler.js';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.status(HttpStatus.OK).json(
      successResponse(
        {
          status: 'ok',
          timestamp: new Date().toISOString(),
        },
        'Service is healthy',
      ),
    );
  }),
);
