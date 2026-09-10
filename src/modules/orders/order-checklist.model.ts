import mongoose, { type HydratedDocument, Schema, type Model } from 'mongoose';

import { QuestionType } from '../checklist-templates/checklist-template.constants.js';
import type { OrderChecklistAnswer } from './order-checklist.answer-types.js';
import type { OrderChecklistQuestionSnapshot } from './order-checklist.types.js';

export interface IOrderChecklist {
  orderId: string;
  checklistTemplateId: mongoose.Types.ObjectId;
  templateVersion: number;
  checklistName: string;
  questionsSnapshot: OrderChecklistQuestionSnapshot[];
  answers: OrderChecklistAnswer[];
  createdAt: Date;
  updatedAt: Date;
}

export type OrderChecklistDocument = HydratedDocument<IOrderChecklist>;

const orderChecklistAnswerSchema = new Schema<OrderChecklistAnswer>(
  {
    questionId: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false },
);

const orderChecklistQuestionSchema = new Schema<OrderChecklistQuestionSnapshot>(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(QuestionType),
      required: true,
    },
    required: {
      type: Boolean,
      required: true,
    },
    order: {
      type: Number,
      required: true,
      min: 0,
    },
    options: {
      type: [String],
      default: undefined,
    },
  },
  { _id: false },
);

const orderChecklistSchema = new Schema<IOrderChecklist>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    checklistTemplateId: {
      type: Schema.Types.ObjectId,
      ref: 'ChecklistTemplate',
      required: true,
    },
    templateVersion: {
      type: Number,
      required: true,
      min: 1,
    },
    checklistName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    questionsSnapshot: {
      type: [orderChecklistQuestionSchema],
      required: true,
    },
    answers: {
      type: [orderChecklistAnswerSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const OrderChecklist: Model<IOrderChecklist> = mongoose.model<IOrderChecklist>(
  'OrderChecklist',
  orderChecklistSchema,
);
