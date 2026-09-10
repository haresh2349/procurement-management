import mongoose from 'mongoose';
import { describe, expect, it } from '@jest/globals';

import { UserRole } from '../../src/common/constants/roles.js';
import type { AuthUser } from '../../src/common/types/express.js';
import { OrderStatus } from '../../src/modules/orders/order.constants.js';
import { buildListOrdersFilter, canViewOrder } from '../../src/modules/orders/order.access.js';
import type { OrderDocument } from '../../src/modules/orders/order.model.js';

const createActor = (role: AuthUser['role'], id: string): AuthUser => ({
  id,
  role,
});

const createOrderDocument = (input: {
  procurementManagerId: string;
  clientId: string;
  inspectionManagerId?: string;
}): OrderDocument =>
  ({
    procurementManagerId: new mongoose.Types.ObjectId(input.procurementManagerId),
    clientId: new mongoose.Types.ObjectId(input.clientId),
    inspectionManagerId: input.inspectionManagerId
      ? new mongoose.Types.ObjectId(input.inspectionManagerId)
      : undefined,
    status: OrderStatus.CREATED,
  }) as OrderDocument;

describe('order.access', () => {
  const pmId = new mongoose.Types.ObjectId().toString();
  const otherPmId = new mongoose.Types.ObjectId().toString();
  const clientId = new mongoose.Types.ObjectId().toString();
  const imId = new mongoose.Types.ObjectId().toString();

  it('allows procurement manager to view own order', () => {
    const actor = createActor(UserRole.PROCUREMENT_MANAGER, pmId);
    const order = createOrderDocument({ procurementManagerId: pmId, clientId });

    expect(canViewOrder(actor, order)).toBe(true);
  });

  it('denies procurement manager access to another procurement manager order', () => {
    const actor = createActor(UserRole.PROCUREMENT_MANAGER, pmId);
    const order = createOrderDocument({ procurementManagerId: otherPmId, clientId });

    expect(canViewOrder(actor, order)).toBe(false);
  });

  it('builds procurement manager list filter with authorization and request filters', () => {
    const actor = createActor(UserRole.PROCUREMENT_MANAGER, pmId);
    const filter = buildListOrdersFilter(actor, {
      status: OrderStatus.CREATED,
      clientId,
    });

    expect(filter).toEqual({
      $and: [
        { procurementManagerId: new mongoose.Types.ObjectId(pmId) },
        {
          status: OrderStatus.CREATED,
          clientId: new mongoose.Types.ObjectId(clientId),
        },
      ],
    });
  });

  it('ignores clientId request filter for client role', () => {
    const actor = createActor(UserRole.CLIENT, clientId);
    const otherClientId = new mongoose.Types.ObjectId().toString();
    const filter = buildListOrdersFilter(actor, {
      clientId: otherClientId,
      status: OrderStatus.CREATED,
    });

    expect(filter).toEqual({
      $and: [
        { clientId: new mongoose.Types.ObjectId(clientId) },
        { status: OrderStatus.CREATED },
      ],
    });
  });

  it('builds inspection manager list filter without inspectionManagerId override', () => {
    const actor = createActor(UserRole.INSPECTION_MANAGER, imId);
    const filter = buildListOrdersFilter(actor, {
      inspectionManagerId: new mongoose.Types.ObjectId().toString(),
      status: OrderStatus.CREATED,
    });

    expect(filter).toEqual({
      $and: [
        { inspectionManagerId: new mongoose.Types.ObjectId(imId) },
        { status: OrderStatus.CREATED },
      ],
    });
  });
});
