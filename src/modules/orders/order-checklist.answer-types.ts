export interface FileAnswerValue {
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export type ChecklistAnswerValue = boolean | string | string[] | FileAnswerValue;

export interface OrderChecklistAnswer {
  questionId: string;
  value: ChecklistAnswerValue;
}
