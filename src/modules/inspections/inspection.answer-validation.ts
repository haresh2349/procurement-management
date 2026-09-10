import { QuestionType } from '../checklist-templates/checklist-template.constants.js';
import type {
  ChecklistAnswerValue,
  FileAnswerValue,
  OrderChecklistAnswer,
} from '../orders/order-checklist.answer-types.js';
import type { OrderChecklistQuestionSnapshot } from '../orders/order-checklist.types.js';

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
};

const isFileAnswerValue = (value: unknown): value is FileAnswerValue => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as FileAnswerValue;

  return (
    isNonEmptyString(candidate.fileId) &&
    isNonEmptyString(candidate.originalName) &&
    isNonEmptyString(candidate.mimeType) &&
    typeof candidate.size === 'number' &&
    candidate.size > 0
  );
};

export const validateAnswerValueForQuestion = (
  question: OrderChecklistQuestionSnapshot,
  value: unknown,
): string | null => {
  switch (question.type) {
    case QuestionType.BOOLEAN:
      return typeof value === 'boolean' ? null : `Question "${question.id}" requires a boolean value`;

    case QuestionType.TEXT:
      return isNonEmptyString(value) ? null : `Question "${question.id}" requires text`;

    case QuestionType.SINGLE_SELECT:
      if (!isNonEmptyString(value)) {
        return `Question "${question.id}" requires a selected option`;
      }

      if (!question.options?.includes(value)) {
        return `Question "${question.id}" has an invalid option`;
      }

      return null;

    case QuestionType.MULTI_SELECT:
      if (!isStringArray(value) || value.length === 0) {
        return `Question "${question.id}" requires at least one selected option`;
      }

      if (!question.options || value.some((option) => !question.options!.includes(option))) {
        return `Question "${question.id}" contains invalid options`;
      }

      return null;

    case QuestionType.FILE:
      return isFileAnswerValue(value)
        ? null
        : `Question "${question.id}" requires uploaded file metadata`;

    default:
      return `Question "${question.id}" has an unsupported type`;
  }
};

export const validateSubmittedAnswers = (
  questions: OrderChecklistQuestionSnapshot[],
  answers: OrderChecklistAnswer[],
): string | null => {
  const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer.value]));

  for (const question of questions) {
    const value = answersByQuestionId.get(question.id);

    if (value === undefined) {
      if (question.required) {
        return `Question "${question.id}" is required`;
      }

      continue;
    }

    const validationError = validateAnswerValueForQuestion(question, value);
    if (validationError) {
      return validationError;
    }
  }

  return null;
};

export const mergeChecklistAnswers = (
  existingAnswers: OrderChecklistAnswer[],
  incomingAnswers: OrderChecklistAnswer[],
): OrderChecklistAnswer[] => {
  const merged = new Map(existingAnswers.map((answer) => [answer.questionId, answer.value]));

  for (const answer of incomingAnswers) {
    merged.set(answer.questionId, answer.value);
  }

  return Array.from(merged.entries()).map(([questionId, value]) => ({
    questionId,
    value: value as ChecklistAnswerValue,
  }));
};
