import mongoose, { type HydratedDocument, Schema, type Model } from 'mongoose';

import { QuestionType } from './checklist-template.constants.js';
import type { ChecklistQuestion } from './checklist-template.types.js';
import { validateChecklistQuestions } from './checklist-template.validation.js';

export interface IChecklistTemplate {
  name: string;
  clientId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  version: number;
  isDefault: boolean;
  questions: ChecklistQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

export type ChecklistTemplateDocument = HydratedDocument<IChecklistTemplate>;

const checklistQuestionSchema = new Schema<ChecklistQuestion>(
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

const checklistTemplateSchema = new Schema<IChecklistTemplate>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    questions: {
      type: [checklistQuestionSchema],
      required: true,
      validate: {
        validator(questions: ChecklistQuestion[]) {
          return validateChecklistQuestions(questions) === null;
        },
        message: (props: { value: ChecklistQuestion[] }) =>
          validateChecklistQuestions(props.value) ?? 'Invalid checklist questions',
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

checklistTemplateSchema.index({ clientId: 1, createdAt: -1 });
checklistTemplateSchema.index({ clientId: 1, isDefault: 1 });

export const ChecklistTemplate: Model<IChecklistTemplate> = mongoose.model<IChecklistTemplate>(
  'ChecklistTemplate',
  checklistTemplateSchema,
);
