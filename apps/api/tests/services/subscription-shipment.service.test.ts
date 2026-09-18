import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { SubscriptionEdition } from "../../src/models/subscription-edition.model.js";
import { SubscriptionShipment } from "../../src/models/subscription-shipment.model.js";
import { StockReservation } from "../../src/models/stock-reservation.model.js";
import { createCycleShipment } from "../../src/services/subscription-shipment.service.js";
import {
  seedPlanWithStripeRefs,
  seedPublishedEdition,
  seedSubscribedAccount,
  seedSubscriptionVariantWithStock,
} from "../helpers/subscription-fixtures.js";

/**
 * `createCycleShipment` (Fase 3 de 1.7.2a, §D del plan) — el corazón del
 * milestone: una caja por ciclo, inventario reservado, los dos E11000 que
 * significan cosas distintas. `servicePeriodStart` en UTC, resuelto a
 * `America/Mexico_City` (ver utils/resolve-cycle.ts).
 */

// 2026-09-15 12:00 UTC = 2026-09-15 06:00 CDMX -> ciclo septiembre 2026.
const MID_SEPTEMBER_UTC = new Date("2026-09-15T12:00:00Z");

describe("services/subscription-shipment — createCycleShipment", () => {
  it("caso feliz: crea la caja, reserva el inventario de la edición, sella firstBilledAt, sin StockReservation", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    const edition = await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 2 }],
    });
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const result = await createCycleShipment({
      accountId: account._id,
      userId: account.userId,
      planId: account.planId,
      invoiceRef: "in_happy_path",
      servicePeriodStart: MID_SEPTEMBER_UTC,
    });

    expect(result.outcome).toBe("created");
    expect(result.shipment.editionId?.toString()).toBe(edition._id.toString());
    expect(result.shipment.editionIncident).toBe(false);
    expect(result.shipment.inventoryIncident).toBe(false);
    expect(result.shipment.cycleYear).toBe(2026);
    expect(result.shipment.cycleMonth).toBe(9);
    expect(result.shipment.reservedItems).toHaveLength(1);
    expect(result.shipment.reservedItems[0]).toMatchObject({ quantity: 2 });
    expect(result.shipment.reservedItems[0]!.variantId.toString()).toBe(variantId.toString());

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(2);
    expect(inventory?.onHand).toBe(10);

    const reloadedEdition = await SubscriptionEdition.findById(edition._id);
    expect(reloadedEdition?.firstBilledAt).toBeInstanceOf(Date);

    expect(await StockReservation.countDocuments({})).toBe(0);
  });

  it("variantId repetido dos veces en la misma edición se fusiona en una sola línea reservada", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [
        { productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 },
        { productId: product._id.toString(), variantId: variantId.toString(), quantity: 2 },
      ],
    });
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const result = await createCycleShipment({
      accountId: account._id,
      userId: account.userId,
      planId: account.planId,
      invoiceRef: "in_merge",
      servicePeriodStart: MID_SEPTEMBER_UTC,
    });

    expect(result.outcome).toBe("created");
    expect(result.shipment.reservedItems).toHaveLength(1);
    expect(result.shipment.reservedItems[0]!.quantity).toBe(3);

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(3);
  });

  it("un cobro a las 03:00 UTC del 1 de septiembre resuelve al ciclo de AGOSTO en America/Mexico_City", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 5 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 8,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const result = await createCycleShipment({
      accountId: account._id,
      userId: account.userId,
      planId: account.planId,
      invoiceRef: "in_timezone",
      servicePeriodStart: new Date("2026-09-01T03:00:00Z"),
    });

    expect(result.outcome).toBe("created");
    expect(result.shipment.cycleYear).toBe(2026);
    expect(result.shipment.cycleMonth).toBe(8);
    expect(result.shipment.editionIncident).toBe(false);
  });

  it("sin edición publicada para el ciclo (falta o sigue en DRAFT): editionIncident, sin editionId, alerta, inventario intacto", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const result = await createCycleShipment({
      accountId: account._id,
      userId: account.userId,
      planId: account.planId,
      invoiceRef: "in_no_edition",
      servicePeriodStart: MID_SEPTEMBER_UTC,
    });

    expect(result.outcome).toBe("created");
    expect(result.shipment.editionIncident).toBe(true);
    expect(result.shipment.editionId).toBeUndefined();
    expect(result.shipment.adminAlertedAt).toBeInstanceOf(Date);
    expect(result.shipment.reservedItems).toHaveLength(0);

    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(0);

    const audit = await AuditLog.findOne({ action: "subscription_shipment_edition_missing", targetId: result.shipment._id });
    expect(audit).not.toBeNull();
  });

  it("inventario insuficiente para 1 de 2 ítems: caja creada, inventoryIncident, se reserva lo que sí alcanza, sin throw", async () => {
    const plan = await seedPlanWithStripeRefs();
    const enough = await seedSubscriptionVariantWithStock({ onHand: 5 });
    const short = await seedSubscriptionVariantWithStock({ onHand: 0 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [
        { productId: enough.product._id.toString(), variantId: enough.variantId.toString(), quantity: 3 },
        { productId: short.product._id.toString(), variantId: short.variantId.toString(), quantity: 2 },
      ],
    });
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const result = await createCycleShipment({
      accountId: account._id,
      userId: account.userId,
      planId: account.planId,
      invoiceRef: "in_shortage",
      servicePeriodStart: MID_SEPTEMBER_UTC,
    });

    expect(result.outcome).toBe("created");
    expect(result.shipment.inventoryIncident).toBe(true);
    expect(result.shipment.reservedItems).toHaveLength(1);
    expect(result.shipment.reservedItems[0]!.variantId.toString()).toBe(enough.variantId.toString());

    const enoughInventory = await Inventory.findOne({ variantId: enough.variantId });
    expect(enoughInventory?.reserved).toBe(3);
    const shortInventory = await Inventory.findOne({ variantId: short.variantId });
    expect(shortInventory?.reserved).toBe(0);

    const audit = await AuditLog.findOne({
      action: "subscription_shipment_inventory_shortage",
      targetId: result.shipment._id,
    });
    expect(audit).not.toBeNull();
  });

  it("una variante de la edición sin fila de Inventory (alta híbrida sin stock inicial) se trata igual que un faltante, sin throw", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product } = await seedSubscriptionVariantWithStock({ onHand: 10 });

    // Alta de stock híbrida (ver decisión de re-alineación de inventario):
    // una variante puede existir en el catálogo sin fila de `Inventory` si
    // nunca se le dio `initialStock`. Se agrega directo al producto para no
    // ensuciar el fixture compartido con un caso de un solo test.
    const untrackedVariant = {
      _id: new Types.ObjectId(),
      sku: "SKU-UNTRACKED",
      name: "Variante sin inventario",
      price: 10000,
      weightGrams: 100,
      dimensionsCm: { length: 5, width: 5, height: 5 },
      isActive: true,
    };
    await Product.updateOne({ _id: product._id }, { $push: { variants: untrackedVariant } });

    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [{ productId: product._id.toString(), variantId: untrackedVariant._id.toString(), quantity: 1 }],
    });
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const result = await createCycleShipment({
      accountId: account._id,
      userId: account.userId,
      planId: account.planId,
      invoiceRef: "in_no_inventory_row",
      servicePeriodStart: MID_SEPTEMBER_UTC,
    });

    expect(result.outcome).toBe("created");
    expect(result.shipment.inventoryIncident).toBe(true);
    expect(result.shipment.reservedItems).toHaveLength(0);
  });

  it("mismo invoiceRef dos veces -> la segunda es 'replayed', sigue habiendo 1 sola caja y el inventario no se reserva dos veces", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 2 }],
    });
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const input = {
      accountId: account._id,
      userId: account.userId,
      planId: account.planId,
      invoiceRef: "in_replay",
      servicePeriodStart: MID_SEPTEMBER_UTC,
    };

    const first = await createCycleShipment(input);
    const second = await createCycleShipment(input);

    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("replayed");
    expect(second.shipment._id.toString()).toBe(first.shipment._id.toString());

    expect(await SubscriptionShipment.countDocuments({ accountId: account._id })).toBe(1);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(2);
  });

  it("factura DISTINTA para un ciclo que ya tiene caja -> 'duplicate_cycle', la caja original queda intacta, se alerta y se audita", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 2 }],
    });
    const account = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    const first = await createCycleShipment({
      accountId: account._id,
      userId: account.userId,
      planId: account.planId,
      invoiceRef: "in_original",
      servicePeriodStart: MID_SEPTEMBER_UTC,
    });

    const second = await createCycleShipment({
      accountId: account._id,
      userId: account.userId,
      planId: account.planId,
      invoiceRef: "in_intruso",
      servicePeriodStart: MID_SEPTEMBER_UTC,
    });

    expect(second.outcome).toBe("duplicate_cycle");
    expect(second.shipment._id.toString()).toBe(first.shipment._id.toString());
    expect(second.shipment.adminAlertedAt).toBeInstanceOf(Date);

    expect(await SubscriptionShipment.countDocuments({ accountId: account._id })).toBe(1);
    const inventory = await Inventory.findOne({ variantId });
    expect(inventory?.reserved).toBe(2); // no se re-reservó por la factura intrusa

    const audit = await AuditLog.findOne({
      action: "subscription_duplicate_cycle_invoice",
      targetId: first.shipment._id,
    });
    expect(audit).not.toBeNull();
    expect(audit?.metadata?.invoiceId).toBe("in_intruso");
  });

  it("firstBilledAt ya sellada por otra cuenta del mismo plan/ciclo: no se re-sella (misma fecha)", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock({ onHand: 10 });
    const edition = await seedPublishedEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 9,
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });
    const firstAccount = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });
    const secondAccount = await seedSubscribedAccount({ planId: plan._id.toString(), status: SubscriptionStatus.ACTIVE });

    await createCycleShipment({
      accountId: firstAccount._id,
      userId: firstAccount.userId,
      planId: firstAccount.planId,
      invoiceRef: "in_first_account",
      servicePeriodStart: MID_SEPTEMBER_UTC,
    });
    const sealedAt = (await SubscriptionEdition.findById(edition._id))!.firstBilledAt!.getTime();

    await createCycleShipment({
      accountId: secondAccount._id,
      userId: secondAccount.userId,
      planId: secondAccount.planId,
      invoiceRef: "in_second_account",
      servicePeriodStart: MID_SEPTEMBER_UTC,
    });
    const stillSealedAt = (await SubscriptionEdition.findById(edition._id))!.firstBilledAt!.getTime();

    expect(stillSealedAt).toBe(sealedAt);
  });
});
