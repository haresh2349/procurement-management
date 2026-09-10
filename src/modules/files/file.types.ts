export interface FileResponse {
  id: string;
  orderId: string;
  orderChecklistId: string;
  questionId: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export interface CreateFileRecordInput {
  orderId: string;
  orderChecklistId: string;
  questionId: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
}
