import mongoose, { type HydratedDocument, Schema, type Model } from 'mongoose';

export interface IFile {
  orderId: string;
  orderChecklistId: mongoose.Types.ObjectId;
  questionId: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type FileDocument = HydratedDocument<IFile>;

const fileSchema = new Schema<IFile>(
  {
    orderId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    orderChecklistId: {
      type: Schema.Types.ObjectId,
      ref: 'OrderChecklist',
      required: true,
      index: true,
    },
    questionId: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    storagePath: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

fileSchema.index({ orderId: 1, questionId: 1 });

export const File: Model<IFile> = mongoose.model<IFile>('File', fileSchema);
