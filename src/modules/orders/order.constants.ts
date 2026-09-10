export const OrderStatus = {
  CREATED: 'CREATED',
  INSPECTION_IN_PROGRESS: 'INSPECTION_IN_PROGRESS',
  INSPECTION_COMPLETED: 'INSPECTION_COMPLETED',
  APPROVED: 'APPROVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_ID_PREFIX = 'ORD';
export const ORDER_ID_SEQUENCE_PADDING = 4;
export const ORDER_ID_PATTERN = new RegExp(`^${ORDER_ID_PREFIX}-\\d{4,}$`);

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatusType, OrderStatusType[]> = {
  [OrderStatus.CREATED]: [OrderStatus.INSPECTION_IN_PROGRESS, OrderStatus.CANCELLED],
  [OrderStatus.INSPECTION_IN_PROGRESS]: [
    OrderStatus.INSPECTION_COMPLETED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.INSPECTION_COMPLETED]: [OrderStatus.APPROVED],
  [OrderStatus.APPROVED]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};
