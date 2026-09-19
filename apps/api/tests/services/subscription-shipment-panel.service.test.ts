import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { SubscriptionShipmentStatus, SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionShipment } from "../../src/models/subscription-shipment.model.js";
import { User } from "../../src/models/user.model.js";
import { createCycleShipment } from "../../src/services/subscription-shipment.service.js";
import {
  getAdminShipmentById,
  listAdminShipments,
} from "../../src/services/subscription-shipment-panel.service.js";
import {
  seedPlanWithStripeRefs,
  seedPublishedEdition,
  seedSubscribedAccount,
  seedSubscriptionVariantWithStock,
} from "../helpers/subscription-fixtures.js";

/**
 * Read model del panel de envíos (Milestone 1.7.2b) — calcado de
 * `order-admin.service.ts`: mismos `parseListQuery`/`resolveSort`/`buildMeta`
 * del resto del proyecto, y la suscriptora hidratada aparte con un `Map`,
 * nunca con un `populate` por fila.
 */

async function seedShipment(opts: { cycleMonth?: number; onHand?: number; withEdition?: boolean } = {}) {
  const plan = await seedPlanWithStripeRefs();
  const period = new Date(Date.UTC(2026, (opts.cycleMonth ?? 9) - 1, 15, 12));
  if (opts.withEdition !== false) {
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: opts.onHand ?? 10 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: opts.cycleMonth ?? 9,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 2 }],
    });
  }
  const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });
  await User.create({
    _id: account.userId,
    email: `sub-${new Types.ObjectId().toString()}@example.com`,
    password: "Contrasena1",
    firstName: "Sofía",
    lastName: "Glow",
    role: "customer",
    emailVerified: true,
  });
  const result = await createCycleShipment({
    accountId: account._id,
    userId: account.userId,
    planId: plan._id,
    invoiceRef: `in_${new Types.ObjectId().toString()}`,
    servicePeriodStart: period,
  });
  return { plan, account, shipment: result.shipment };
}

describe("services/subscription-shipment-panel — listado", () => {
  it("devuelve filas con plan, ciclo, suscriptora y meta de paginación", async () => {
    const { plan, shipment } = await seedShipment();

    const { rows, meta } = await listAdminShipments({ page: 1, limit: 20, sort: { field: "createdAt", direction: "desc" } });

    expect(meta.total).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: shipment._id.toString(),
      status: SubscriptionShipmentStatus.PENDING,
      cycleYear: 2026,
      cycleMonth: 9,
      planName: plan.name,
    });
    expect(rows[0]?.customer).toMatchObject({ firstName: "Sofía", lastName: "Glow" });
  });

  it("filtra por estado", async () => {
    const { shipment } = await seedShipment();
    await seedShipment();
    await SubscriptionShipment.updateOne(
      { _id: shipment._id },
      { $set: { status: SubscriptionShipmentStatus.SHIPPED } },
    );

    const { rows, meta } = await listAdminShipments({
      page: 1,
      limit: 20,
      sort: { field: "createdAt", direction: "desc" },
      status: SubscriptionShipmentStatus.SHIPPED,
    });

    expect(meta.total).toBe(1);
    expect(rows[0]?.id).toBe(shipment._id.toString());
  });

  it("filtra por ciclo", async () => {
    await seedShipment({ cycleMonth: 9 });
    await seedShipment({ cycleMonth: 8 });

    const { rows } = await listAdminShipments({
      page: 1,
      limit: 20,
      sort: { field: "createdAt", direction: "desc" },
      cycleYear: 2026,
      cycleMonth: 8,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.cycleMonth).toBe(8);
  });

  it("filtra por incidencia: las cajas que necesitan atención de la admin", async () => {
    await seedShipment();
    const conIncidencia = await seedShipment({ withEdition: false });

    const { rows, meta } = await listAdminShipments({
      page: 1,
      limit: 20,
      sort: { field: "createdAt", direction: "desc" },
      incident: true,
    });

    expect(meta.total).toBe(1);
    expect(rows[0]?.id).toBe(conIncidencia.shipment._id.toString());
    expect(rows[0]?.editionIncident).toBe(true);
  });
});

describe("services/subscription-shipment-panel — detalle", () => {
  it("devuelve el envío con sus líneas reservadas", async () => {
    const { shipment } = await seedShipment();

    const detail = await getAdminShipmentById(shipment._id.toString());

    expect(detail.id).toBe(shipment._id.toString());
    expect(detail.reservedItems).toHaveLength(1);
    expect(detail.reservedItems[0]?.quantity).toBe(2);
  });

  it("un envío inexistente responde 404", async () => {
    await expect(getAdminShipmentById(new Types.ObjectId().toString())).rejects.toMatchObject({ statusCode: 404 });
  });
});
