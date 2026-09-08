import type { Request, Response } from 'express';

import { UserRole } from '../../common/constants/roles.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { successResponse } from '../../common/types/api-response.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import * as userService from './user.service.js';
import type {
  AssignInspectionManagerBody,
  CreateUserByAdminBody,
  CreateUserByProcurementManagerBody,
  ListUsersQueryInput,
} from './user.validation.js';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }

  return req.user;
};

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);

  const user =
    actor.role === UserRole.ADMIN
      ? await userService.createUserByAdmin(actor.id, req.body as CreateUserByAdminBody)
      : actor.role === UserRole.PROCUREMENT_MANAGER
        ? await userService.createUserByProcurementManager(
            actor.id,
            req.body as CreateUserByProcurementManagerBody,
          )
        : null;

  if (!user) {
    throw new AppError('Insufficient permissions', HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }

  res.status(HttpStatus.CREATED).json(successResponse(user, 'User created successfully'));
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const query = res.locals.validatedQuery as ListUsersQueryInput;
  const users = await userService.listUsers(actor, query);

  res.status(HttpStatus.OK).json(successResponse(users, 'Users retrieved successfully'));
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireActor(req);
  const { id } = res.locals.validatedParams as { id: string };
  const user = await userService.getUserById(actor, id);

  res.status(HttpStatus.OK).json(successResponse(user, 'User retrieved successfully'));
});

export const assignInspectionManager = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as AssignInspectionManagerBody;
  const { inspectionManagerId } = res.locals.validatedParams as { inspectionManagerId: string };
  const user = await userService.assignInspectionManager(inspectionManagerId, body.managerId);

  res.status(HttpStatus.OK).json(successResponse(user, 'Inspection Manager assigned successfully'));
});

export const unassignInspectionManager = asyncHandler(async (_req: Request, res: Response) => {
  const { inspectionManagerId } = res.locals.validatedParams as { inspectionManagerId: string };
  const user = await userService.unassignInspectionManager(inspectionManagerId);

  res
    .status(HttpStatus.OK)
    .json(successResponse(user, 'Inspection Manager unassigned successfully'));
});
