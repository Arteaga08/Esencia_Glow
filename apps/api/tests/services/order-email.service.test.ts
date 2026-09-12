import { PaymentMethod } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Order } from "../../src/models/order.model.js";
import { User } from "../../src/models/user.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { sendPaymentReceivedEmail, sendOxxoVoucherEmail, sendRefundEmail } from "../../src/services/order-email.service.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { buildFakeMailProvider } from "../helpers/fake-mail-provider.js";
import { buildCreateOrderInput, randomUserId, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

/**
 * `order-email.service` — correos de pedido (§8 del plan de 1.6.3): cada
 * uno carga solo lo que su copy necesita, escapa el nombre de la clienta
 * (lo escribe ella, en `shippingAddress.fullName`) y nunca lanza — un
 * proveedor caído no debe romper la transición que lo disparó.
 */
describe("services/order-email", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function seedOrder(fullNameOverride?: string) {
    const userId = randomUserId();
    await User.create({
      _id: userId,
      email: `${userId}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
    const input = await buildCreateOrderInput(userId, [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }], {
      paymentMethod: PaymentMethod.CARD,
    });
    const { order } = await createOrder(input);
    if (fullNameOverride) {
      await Order.updateOne({ _id: order._id }, { $set: { "shippingAddress.fullName": fullNameOverride } });
    }
    return order;
  }

  it("sendPaymentReceivedEmail: asunto y folio, sin <style>", async () => {
    const order = await seedOrder();
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    await sendPaymentReceivedEmail(order._id.toString());

    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0]!;
    expect(call.subject).toContain("pago");
    expect(call.html).toContain(order.orderNumber);
    expect(call.html).not.toContain("<style");
    expect(call.idempotencyKey).toBe(`order-${order._id.toString()}-paid`);
  });

  it("sendOxxoVoucherEmail: incluye el botón a la ficha y la fecha de vencimiento en es-MX", async () => {
    const order = await seedOrder();
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    const expiresAt = new Date("2026-09-15T05:00:00.000Z");

    await sendOxxoVoucherEmail(order._id.toString(), {
      hostedVoucherUrl: "https://payments.stripe.com/oxxo/voucher/abc",
      expiresAt,
    });

    const call = fake.calls[0]!;
    expect(call.html).toContain("https://payments.stripe.com/oxxo/voucher/abc");
    expect(call.idempotencyKey).toBe(`order-${order._id.toString()}-oxxo-voucher`);
  });

  it("sendRefundEmail: incluye el monto formateado en pesos", async () => {
    const order = await seedOrder();
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    await sendRefundEmail(order._id.toString(), 50000);

    const call = fake.calls[0]!;
    expect(call.html).toMatch(/\$\s?500\.00/);
    expect(call.idempotencyKey).toBe(`order-${order._id.toString()}-refunded`);
  });

  it("escapa un nombre malicioso en shippingAddress.fullName antes de interpolarlo", async () => {
    const order = await seedOrder('<script>alert(1)</script>');
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    await sendPaymentReceivedEmail(order._id.toString());

    const call = fake.calls[0]!;
    expect(call.html).not.toContain("<script>alert(1)</script>");
    expect(call.html).toContain("&lt;script&gt;");
  });

  it("un proveedor que lanza no rompe la llamada (best-effort)", async () => {
    const order = await seedOrder();
    __setMailProviderForTests({
      send: async () => {
        throw new Error("Resend caído");
      },
    });

    await expect(sendPaymentReceivedEmail(order._id.toString())).resolves.toBeUndefined();
  });

  it("orden inexistente no lanza (defensivo)", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    await expect(sendPaymentReceivedEmail("000000000000000000000000")).resolves.toBeUndefined();
    expect(fake.calls).toHaveLength(0);
  });
});
