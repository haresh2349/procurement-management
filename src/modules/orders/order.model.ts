import mongoose, { type HydratedDocument, Schema, type Model } from 'mongoose';

import { OrderStatus, type OrderStatusType } from './order.constants.js';

export interface IOrder {
  orderId: string;
  clientId: mongoose.Types.ObjectId;
  procurementManagerId: mongoose.Types.ObjectId;
  inspectionManagerId?: mongoose.Types.ObjectId;
  status: OrderStatusType;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderDocument = HydratedDocument<IOrder>;

const orderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    procurementManagerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    inspectionManagerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
      default: OrderStatus.CREATED,
    },
    createdBy: {
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

orderSchema.index({ procurementManagerId: 1, createdAt: -1 });
orderSchema.index({ inspectionManagerId: 1, status: 1 });
orderSchema.index({ clientId: 1, createdAt: -1 });

export const Order: Model<IOrder> = mongoose.model<IOrder>('Order', orderSchema);
