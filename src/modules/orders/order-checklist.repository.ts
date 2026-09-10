import type { OrderChecklistDocument } from './order-checklist.model.js';
import { OrderChecklist } from './order-checklist.model.js';
import type { OrderChecklistAnswer } from './order-checklist.answer-types.js';
import type {
  CreateOrderChecklistSnapshotInput,
  OrderChecklistResponse,
} from './order-checklist.types.js';

export const toOrderChecklistResponse = (
  orderChecklist: OrderChecklistDocument,
): OrderChecklistResponse => ({
  id: orderChecklist._id.toString(),
  orderId: orderChecklist.orderId,
  checklistTemplateId: orderChecklist.checklistTemplateId.toString(),
  templateVersion: orderChecklist.templateVersion,
  checklistName: orderChecklist.checklistName,
  questionsSnapshot: orderChecklist.questionsSnapshot.map((question) => ({
    id: question.id,
    label: question.label,
    type: question.type,
    required: question.required,
    order: question.order,
    ...(question.options ? { options: [...question.options] } : {}),
  })),
  answers: orderChecklist.answers.map((answer) => ({
    questionId: answer.questionId,
    value: answer.value,
  })),
  createdAt: orderChecklist.createdAt,
  updatedAt: orderChecklist.updatedAt,
});

export const findByOrderId = async (orderId: string): Promise<OrderChecklistDocument | null> => {
  return OrderChecklist.findOne({ orderId });
};

export const existsByOrderId = async (orderId: string): Promise<boolean> => {
  const checklist = await OrderChecklist.exists({ orderId });
  return checklist !== null;
};

export const createSnapshot = async (
  input: CreateOrderChecklistSnapshotInput,
): Promise<OrderChecklistDocument> => {
  return OrderChecklist.create({
    orderId: input.orderId,
    checklistTemplateId: input.checklistTemplateId,
    templateVersion: input.templateVersion,
    checklistName: input.checklistName,
    questionsSnapshot: input.questionsSnapshot,
    answers: [],
  });
};

export const saveAnswers = async (
  orderId: string,
  answers: OrderChecklistAnswer[],
): Promise<OrderChecklistDocument | null> => {
  return OrderChecklist.findOneAndUpdate(
    { orderId },
    { answers },
    { returnDocument: 'after', runValidators: true },
  );
};
