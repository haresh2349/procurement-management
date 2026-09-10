import type { QuestionTypeValue } from '../checklist-templates/checklist-template.constants.js';
import type { OrderChecklistAnswer } from './order-checklist.answer-types.js';

export interface OrderChecklistQuestionSnapshot {
  id: string;
  label: string;
  type: QuestionTypeValue;
  required: boolean;
  order: number;
  options?: string[];
}

export interface OrderChecklistResponse {
  id: string;
  orderId: string;
  checklistTemplateId: string;
  templateVersion: number;
  checklistName: string;
  questionsSnapshot: OrderChecklistQuestionSnapshot[];
  answers: OrderChecklistAnswer[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderChecklistSnapshotInput {
  orderId: string;
  checklistTemplateId: string;
  templateVersion: number;
  checklistName: string;
  questionsSnapshot: OrderChecklistQuestionSnapshot[];
}
