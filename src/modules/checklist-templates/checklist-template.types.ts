import type { QuestionTypeValue } from './checklist-template.constants.js';

export interface ChecklistQuestion {
  id: string;
  label: string;
  type: QuestionTypeValue;
  required: boolean;
  order: number;
  options?: string[];
}

export interface ChecklistTemplateResponse {
  id: string;
  name: string;
  clientId: string;
  createdBy: string;
  version: number;
  isDefault: boolean;
  questions: ChecklistQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChecklistTemplateInput {
  name: string;
  clientId: string;
  isDefault?: boolean;
  questions: Array<{
    label: string;
    type: ChecklistQuestion['type'];
    required: boolean;
    order: number;
    options?: string[];
  }>;
}

export interface UpdateChecklistTemplateInput {
  name?: string;
  isDefault?: boolean;
  questions?: Array<{
    id?: string;
    label: string;
    type: ChecklistQuestion['type'];
    required: boolean;
    order: number;
    options?: string[];
  }>;
}

export interface ListChecklistTemplatesQuery {
  clientId?: string;
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedChecklistTemplatesResponse {
  items: ChecklistTemplateResponse[];
  pagination: PaginationMeta;
}
