import { OrderStatus, ShippingCarrier } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Order } from "../../src/models/order.model.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { sendShipmentNotificationEmail } from "../../src/services/order-email.service.js";
import { changeOrderStatus, updateOrderShipment } from "../../src/services/order-admin-status.service.js";
import { applySystemOrderTransition } from "../../src/services/order-system-transition.service.js";
import { buildFakeMailProvider, type FakeMailProvider } from "../helpers/fake-mail-provider.js";
import { resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";
import { seedPaidOrder } from "../helpers/paid-order-fixtures.js";

const SHIPMENT = {
  carrier: ShippingCarrier.ESTAFETA,
  trackingNumber: "EST482019374651",
  trackingUrl: "https://rastreo.example/EST482019374651",
};

/**
 * Correos al cliente por transición (Milestone 3.6): `processing` avisa que
 * se prepara el pedido y `shipped` manda la guía, tanto por el camino del
 * sistema (guía lista, rastreo) como por el del admin. El envío es
 * fire-and-forget, así que cada test espera a que el correo aparezca.
 */
describe("services/order-status-email", () => {
  let fake: FakeMailProvider;

  beforeEach(() => {
    resetCheckoutFixtureCounter();
    fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
  });

  it("sistema: paid -> processing envía el correo de preparación, una sola vez", async () => {
    const { orderId } = await seedPaidOrder();
    fake.calls.length = 0;

    await applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });

    await vi.waitFor(() => expect(fake.calls).toHaveLength(1));
    const call = fake.calls[0]!;
    expect(call.subject).toContain("Estamos preparando tu pedido");
    expect(call.idempotencyKey).toBe(`order-${orderId}-processing`);
    expect(call.html).not.toContain("<style");
  });

  it("sistema: processing -> shipped envía la guía con paquetería, número y botón de rastreo", async () => {
    const { orderId } = await seedPaidOrder();
    await applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });
    await vi.waitFor(() => expect(fake.calls.length).toBeGreaterThanOrEqual(1));
    fake.calls.length = 0;

    await applySystemOrderTransition({ orderId, from: OrderStatus.PROCESSING, to: OrderStatus.SHIPPED, shipment: SHIPMENT });

    await vi.waitFor(() => expect(fake.calls).toHaveLength(1));
    const call = fake.calls[0]!;
    expect(call.subject).toContain("va en camino");
    expect(call.idempotencyKey).toBe(`order-${orderId}-shipped`);
    expect(call.html).toContain("Estafeta");
    expect(call.html).toContain("EST482019374651");
    expect(call.html).toContain('href="https://rastreo.example/EST482019374651"');
  });

  it("sistema: una carrera perdida (skipped_state) no envía nada", async () => {
    const { orderId } = await seedPaidOrder();
    fake.calls.length = 0;

    const result = await applySystemOrderTransition({ orderId, from: OrderStatus.PROCESSING, to: OrderStatus.SHIPPED, shipment: SHIPMENT });

    expect(result.outcome).toBe("skipped_state");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.calls).toHaveLength(0);
  });

  it("admin: paid -> processing -> shipped envía los dos correos, y corregir la guía NO reenvía", async () => {
    const { orderId, adminId } = await seedPaidOrder();
    fake.calls.length = 0;

    await changeOrderStatus({ orderId, targetStatus: OrderStatus.PROCESSING, adminId });
    await vi.waitFor(() => expect(fake.calls).toHaveLength(1));
    expect(fake.calls[0]!.subject).toContain("Estamos preparando");

    await changeOrderStatus({ orderId, targetStatus: OrderStatus.SHIPPED, adminId, shipment: SHIPMENT });
    await vi.waitFor(() => expect(fake.calls).toHaveLength(2));
    expect(fake.calls[1]!.subject).toContain("va en camino");

    await updateOrderShipment({ orderId, adminId, trackingNumber: "EST000000000001" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.calls).toHaveLength(2);
  });

  it("admin: shipped -> delivered no envía correo de estado (no hay uno para ese paso)", async () => {
    const { orderId, adminId } = await seedPaidOrder();
    await changeOrderStatus({ orderId, targetStatus: OrderStatus.PROCESSING, adminId });
    await changeOrderStatus({ orderId, targetStatus: OrderStatus.SHIPPED, adminId, shipment: SHIPMENT });
    await vi.waitFor(() => expect(fake.calls.some((c) => c.subject.includes("va en camino"))).toBe(true));
    const before = fake.calls.length;

    await changeOrderStatus({ orderId, targetStatus: OrderStatus.DELIVERED, adminId });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.calls).toHaveLength(before);
  });

  it("guía sin trackingUrl: el correo sale sin botón", async () => {
    const { orderId, adminId } = await seedPaidOrder();
    await changeOrderStatus({ orderId, targetStatus: OrderStatus.PROCESSING, adminId });
    await changeOrderStatus({
      orderId,
      targetStatus: OrderStatus.SHIPPED,
      adminId,
      shipment: { carrier: ShippingCarrier.FEDEX, trackingNumber: "FDX-1" },
    });

    await vi.waitFor(() => expect(fake.calls.some((c) => c.subject.includes("va en camino"))).toBe(true));
    const shipped = fake.calls.find((c) => c.subject.includes("va en camino"))!;
    expect(shipped.html).toContain("FDX-1");
    expect(shipped.html).not.toContain("<a ");
  });

  it("un trackingUrl con esquema javascript: no llega al correo", async () => {
    const { orderId } = await seedPaidOrder();
    await Order.updateOne(
      { _id: orderId },
      { $set: { shipment: { carrier: ShippingCarrier.FEDEX, trackingNumber: "FDX-2", trackingUrl: "javascript:alert(1)", shippedAt: new Date() } } },
    );
    fake.calls.length = 0;

    await sendShipmentNotificationEmail(orderId);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.html).not.toContain("javascript:");
    expect(fake.calls[0]!.html).not.toContain("<a ");
  });

  it("sin guía guardada no envía el correo de guía", async () => {
    const { orderId } = await seedPaidOrder();
    fake.calls.length = 0;

    await sendShipmentNotificationEmail(orderId);

    expect(fake.calls).toHaveLength(0);
  });

  it("el correo de preparación no repite precios: solo líneas y folio", async () => {
    const { orderId } = await seedPaidOrder();
    fake.calls.length = 0;

    await applySystemOrderTransition({ orderId, from: OrderStatus.PAID, to: OrderStatus.PROCESSING });

    await vi.waitFor(() => expect(fake.calls).toHaveLength(1));
    expect(fake.calls[0]!.html).toContain("Tu pedido");
    expect(fake.calls[0]!.html).not.toMatch(/\$\s?\d/);
  });
});
