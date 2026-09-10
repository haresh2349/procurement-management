export const QuestionType = {
  BOOLEAN: 'BOOLEAN',
  SINGLE_SELECT: 'SINGLE_SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  TEXT: 'TEXT',
  FILE: 'FILE',
} as const;

export type QuestionTypeValue = (typeof QuestionType)[keyof typeof QuestionType];

export const SELECT_QUESTION_TYPES: QuestionTypeValue[] = [
  QuestionType.SINGLE_SELECT,
  QuestionType.MULTI_SELECT,
];

export const NON_SELECT_QUESTION_TYPES: QuestionTypeValue[] = [
  QuestionType.BOOLEAN,
  QuestionType.TEXT,
  QuestionType.FILE,
];
