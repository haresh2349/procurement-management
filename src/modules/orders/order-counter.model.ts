import mongoose, { Schema, type Model } from 'mongoose';

interface IOrderCounter {
  _id: string;
  seq: number;
}

const orderCounterSchema = new Schema<IOrderCounter>(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    versionKey: false,
    timestamps: false,
  },
);

export const OrderCounter: Model<IOrderCounter> = mongoose.model<IOrderCounter>(
  'OrderCounter',
  orderCounterSchema,
);
