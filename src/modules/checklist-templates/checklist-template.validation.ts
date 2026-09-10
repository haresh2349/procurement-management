import {
  NON_SELECT_QUESTION_TYPES,
  QuestionType,
  SELECT_QUESTION_TYPES,
  type QuestionTypeValue,
} from './checklist-template.constants.js';
import type { ChecklistQuestion } from './checklist-template.types.js';

const hasDuplicateValues = (values: string[]): boolean => {
  return new Set(values.map((value) => value.trim())).size !== values.length;
};

const validateQuestionOptions = (question: ChecklistQuestion): string | null => {
  const hasOptions = question.options !== undefined && question.options.length > 0;

  if (SELECT_QUESTION_TYPES.includes(question.type)) {
    if (!hasOptions) {
      return `Question "${question.id}" requires at least 2 options`;
    }

    if (question.options!.length < 2) {
      return `Question "${question.id}" requires at least 2 options`;
    }

    if (hasDuplicateValues(question.options!)) {
      return `Question "${question.id}" contains duplicate options`;
    }

    return null;
  }

  if (NON_SELECT_QUESTION_TYPES.includes(question.type) && hasOptions) {
    return `Question "${question.id}" must not include options for type ${question.type}`;
  }

  if (!Object.values(QuestionType).includes(question.type as QuestionTypeValue)) {
    return `Question "${question.id}" has an invalid type`;
  }

  return null;
};

export const validateChecklistQuestions = (questions: ChecklistQuestion[]): string | null => {
  if (questions.length === 0) {
    return 'Checklist must contain at least one question';
  }

  const questionIds = new Set<string>();

  for (const question of questions) {
    if (!question.id?.trim()) {
      return 'Each question must have a stable id';
    }

    if (questionIds.has(question.id)) {
      return `Duplicate question id "${question.id}"`;
    }

    questionIds.add(question.id);

    if (!question.label?.trim()) {
      return `Question "${question.id}" must have a label`;
    }

    const optionsError = validateQuestionOptions(question);
    if (optionsError) {
      return optionsError;
    }
  }

  return null;
};
