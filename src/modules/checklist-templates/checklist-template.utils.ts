import { randomUUID } from 'node:crypto';

import type { ChecklistQuestion } from './checklist-template.types.js';

export interface ChecklistQuestionInput {
  label: string;
  type: ChecklistQuestion['type'];
  required: boolean;
  order: number;
  options?: string[];
}

export interface ChecklistQuestionUpdateInput extends ChecklistQuestionInput {
  id?: string;
}

export const assignQuestionIds = (questions: ChecklistQuestionInput[]): ChecklistQuestion[] => {
  return questions.map((question) => ({
    ...question,
    id: randomUUID(),
  }));
};

export const mergeQuestionsOnUpdate = (
  existingQuestions: ChecklistQuestion[],
  incomingQuestions: ChecklistQuestionUpdateInput[],
): ChecklistQuestion[] => {
  const existingIds = new Set(existingQuestions.map((question) => question.id));

  return incomingQuestions.map((question) => {
    if (question.id) {
      if (!existingIds.has(question.id)) {
        throw new Error(`Unknown question id "${question.id}"`);
      }

      return {
        id: question.id,
        label: question.label,
        type: question.type,
        required: question.required,
        order: question.order,
        ...(question.options ? { options: [...question.options] } : {}),
      };
    }

    return {
      id: randomUUID(),
      label: question.label,
      type: question.type,
      required: question.required,
      order: question.order,
      ...(question.options ? { options: [...question.options] } : {}),
    };
  });
};

export const serializeQuestionsForVersionCheck = (questions: ChecklistQuestion[]): string => {
  const normalized = [...questions]
    .sort((a, b) => a.order - b.order)
    .map((question) => ({
      label: question.label,
      type: question.type,
      required: question.required,
      order: question.order,
      options: question.options ?? null,
    }));

  return JSON.stringify(normalized);
};
