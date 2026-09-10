import { Router } from 'express';

import { UserRole } from '../../common/constants/roles.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { uploadSingleChecklistFile } from '../../middlewares/upload.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import * as fileController from '../files/file.controller.js';
import * as inspectionController from '../inspections/inspection.controller.js';
import {
  orderChecklistParamsSchema,
  orderChecklistQuestionParamsSchema,
  updateChecklistAnswersSchema,
} from '../inspections/inspection.validation.js';
import * as orderController from './order.controller.js';
import {
  assignInspectionManagerSchema,
  attachChecklistSchema,
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  updateOrderStatusSchema,
} from './order.validation.js';

const orderReadRoles = [
  UserRole.ADMIN,
  UserRole.PROCUREMENT_MANAGER,
  UserRole.INSPECTION_MANAGER,
  UserRole.CLIENT,
] as const;

export const orderRouter = Router();

orderRouter.get(
  '/',
  authenticate,
  authorize(...orderReadRoles),
  validate(listOrdersQuerySchema, 'query'),
  orderController.listOrders,
);

orderRouter.get(
  '/:orderId',
  authenticate,
  authorize(...orderReadRoles),
  validate(orderIdParamSchema, 'params'),
  orderController.getOrderByOrderId,
);

orderRouter.get(
  '/:orderId/checklist',
  authenticate,
  authorize(...orderReadRoles),
  validate(orderChecklistParamsSchema, 'params'),
  inspectionController.getOrderChecklist,
);

orderRouter.post(
  '/:orderId/checklist',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER),
  validate(orderIdParamSchema, 'params'),
  validate(attachChecklistSchema),
  orderController.attachChecklist,
);

orderRouter.patch(
  '/:orderId/checklist/answers',
  authenticate,
  authorize(UserRole.INSPECTION_MANAGER),
  validate(orderChecklistParamsSchema, 'params'),
  validate(updateChecklistAnswersSchema),
  inspectionController.updateChecklistAnswers,
);

orderRouter.post(
  '/:orderId/checklist/submit',
  authenticate,
  authorize(UserRole.INSPECTION_MANAGER),
  validate(orderChecklistParamsSchema, 'params'),
  inspectionController.submitInspection,
);

orderRouter.post(
  '/:orderId/checklist/questions/:questionId/file',
  authenticate,
  authorize(UserRole.INSPECTION_MANAGER),
  validate(orderChecklistQuestionParamsSchema, 'params'),
  uploadSingleChecklistFile,
  fileController.uploadChecklistFile,
);

orderRouter.patch(
  '/:orderId/inspection-manager',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER),
  validate(orderIdParamSchema, 'params'),
  validate(assignInspectionManagerSchema),
  orderController.assignInspectionManager,
);

orderRouter.patch(
  '/:orderId/status',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER, UserRole.INSPECTION_MANAGER),
  validate(orderIdParamSchema, 'params'),
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus,
);

orderRouter.post(
  '/',
  authenticate,
  authorize(UserRole.PROCUREMENT_MANAGER),
  validate(createOrderSchema),
  orderController.createOrder,
);
