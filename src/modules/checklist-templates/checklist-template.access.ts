import mongoose from 'mongoose';

import type { AuthUser } from '../../common/types/express.js';
import { UserRole } from '../../common/constants/roles.js';
import type { ListChecklistTemplatesQuery } from './checklist-template.types.js';
import type { ChecklistTemplateDocument } from './checklist-template.model.js';

export const canAccessChecklistTemplate = (
  actor: AuthUser,
  template: ChecklistTemplateDocument,
): boolean => {
  if (actor.role === UserRole.ADMIN) {
    return true;
  }

  if (actor.role === UserRole.PROCUREMENT_MANAGER) {
    return template.createdBy.toString() === actor.id;
  }

  return false;
};

const applyClientFilter = (
  filter: Record<string, unknown>,
  clientId?: string,
): Record<string, unknown> => {
  if (!clientId) {
    return filter;
  }

  return {
    $and: [filter, { clientId: new mongoose.Types.ObjectId(clientId) }],
  };
};

export const buildListChecklistTemplatesFilter = (
  actor: AuthUser,
  query?: Pick<ListChecklistTemplatesQuery, 'clientId'>,
): Record<string, unknown> | null => {
  if (actor.role === UserRole.ADMIN) {
    return applyClientFilter({}, query?.clientId);
  }

  if (actor.role === UserRole.PROCUREMENT_MANAGER) {
    return applyClientFilter(
      { createdBy: new mongoose.Types.ObjectId(actor.id) },
      query?.clientId,
    );
  }

  return null;
};
