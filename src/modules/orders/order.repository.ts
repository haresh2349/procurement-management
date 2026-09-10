import {
  ORDER_ID_PREFIX,
  ORDER_ID_SEQUENCE_PADDING,
  OrderStatus,
  type OrderStatusType,
} from './order.constants.js';
import { OrderCounter } from './order-counter.model.js';
import type { OrderDocument } from './order.model.js';
import { Order } from './order.model.js';
import type { CreateOrderPersistenceInput, OrderResponse } from './order.types.js';

const ORDER_ID_COUNTER_KEY = 'orderId';

export const toOrderResponse = (order: OrderDocument): OrderResponse => ({
  orderId: order.orderId,
  clientId: order.clientId.toString(),
  procurementManagerId: order.procurementManagerId.toString(),
  inspectionManagerId: order.inspectionManagerId?.toString(),
  status: order.status,
  createdBy: order.createdBy.toString(),
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

export const generateOrderId = async (): Promise<string> => {
  const counter = await OrderCounter.findOneAndUpdate(
    { _id: ORDER_ID_COUNTER_KEY },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true },
  );

  if (!counter) {
    throw new Error('Failed to generate order id');
  }

  const sequence = String(counter.seq).padStart(ORDER_ID_SEQUENCE_PADDING, '0');

  return `${ORDER_ID_PREFIX}-${sequence}`;
};

export const create = async (input: CreateOrderPersistenceInput): Promise<OrderDocument> => {
  return Order.create({
    orderId: input.orderId,
    clientId: input.clientId,
    procurementManagerId: input.procurementManagerId,
    inspectionManagerId: input.inspectionManagerId,
    status: OrderStatus.CREATED,
    createdBy: input.createdBy,
  });
};

export const findByOrderId = async (orderId: string): Promise<OrderDocument | null> => {
  return Order.findOne({ orderId });
};

export const findOne = async (filter: Record<string, unknown>): Promise<OrderDocument | null> => {
  return Order.findOne(filter);
};

export const findMany = async (
  filter: Record<string, unknown>,
  options?: { skip?: number; limit?: number; sort?: Record<string, 1 | -1> },
): Promise<OrderDocument[]> => {
  const query = Order.find(filter);

  if (options?.sort) {
    query.sort(options.sort);
  } else {
    query.sort({ createdAt: -1 });
  }

  if (options?.skip !== undefined) {
    query.skip(options.skip);
  }

  if (options?.limit !== undefined) {
    query.limit(options.limit);
  }

  return query;
};

export const countDocuments = async (filter: Record<string, unknown>): Promise<number> => {
  return Order.countDocuments(filter);
};

export const findPaginated = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
): Promise<{ orders: OrderDocument[]; total: number }> => {
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  return { orders, total };
};

export const updateInspectionManager = async (
  orderId: string,
  inspectionManagerId: string,
): Promise<OrderDocument | null> => {
  return Order.findOneAndUpdate(
    { orderId },
    { inspectionManagerId },
    { returnDocument: 'after', runValidators: true },
  );
};

export const updateStatus = async (
  orderId: string,
  status: OrderStatusType,
): Promise<OrderDocument | null> => {
  return Order.findOneAndUpdate(
    { orderId },
    { status },
    { returnDocument: 'after', runValidators: true },
  );
};
