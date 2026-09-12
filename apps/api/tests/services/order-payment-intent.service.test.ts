import { PaymentMethod } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../../src/models/user.model.js";
import { Order } from "../../src/models/order.model.js";
import { StockReservation } from "../../src/models/stock-reservation.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { buildFakeMailProvider } from "../helpers/fake-mail-provider.js";
import {
  buildCreateOrderInput,
  randomUserId,
  resetCheckoutFixtureCounter,
  seedVariantWithStock,
} from "../helpers/checkout-fixtures.js";

/**
 * `ensurePaymentIntent` — gancho de checkout de 1.6 (§B del plan): crea el
 * PaymentIntent la primera vez (idempotente hacia Stripe) y, en llamadas
 * posteriores (replay, reanudar), consulta el existente sin crear otro.
 */
describe("services/order-payment-intent — ensurePaymentIntent", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function createPendingOrder(paymentMethod: PaymentMethod = PaymentMethod.CARD) {
    const userId = randomUserId();
    await User.create({
      _id: userId,
      email: `${userId}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });
    const { variantId } = await seedVariantWithStock({ price: 50000 });
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 2 }];
    const input = await buildCreateOrderInput(userId, lines, { paymentMethod });
    const { order } = await createOrder(input);
    return { order, userId };
  }

  it("tarjeta: crea el PaymentIntent, guarda intentId y devuelve clientSecret", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider();

    const result = await ensurePaymentIntent(order._id.toString(), userId, { provider });

    expect(provider.authorize).toHaveBeenCalledTimes(1);
    expect(result.payment.method).toBe(PaymentMethod.CARD);
    expect(result.payment.clientSecret).toMatch(/^pi_fake_1_secret$/);

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.payment.intentId).toBe("pi_fake_1");
  });

  it("una segunda llamada NO crea otro PaymentIntent: consulta el existente", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider();

    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    const second = await ensurePaymentIntent(order._id.toString(), userId, { provider });

    expect(provider.authorize).toHaveBeenCalledTimes(1);
    expect(provider.getAuthorization).toHaveBeenCalledTimes(1);
    expect(second.payment.clientSecret).toBe("pi_fake_1_secret");
  });

  it("OXXO: guarda voucherExpiresAt y ajusta order.expiresAt/reservation.expiresAt en la misma operación", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.OXXO);
    const fixedExpiry = new Date("2026-02-01T05:59:00.000Z");
    const provider = buildFakePaymentProvider({
      authorize: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo_1",
        status: "awaiting_customer",
        amountCents: 100000,
        currency: "mxn",
        voucher: { expiresAt: fixedExpiry, hostedVoucherUrl: "https://payments.stripe.com/oxxo/voucher/abc" },
      }),
    });

    const result = await ensurePaymentIntent(order._id.toString(), userId, { provider });

    expect(result.payment.method).toBe(PaymentMethod.OXXO);
    expect(result.payment.oxxoVoucher?.hostedVoucherUrl).toBe("https://payments.stripe.com/oxxo/voucher/abc");
    expect(result.payment.oxxoVoucher?.expiresAt).toBe(fixedExpiry.toISOString());

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.payment.voucherExpiresAt?.getTime()).toBe(fixedExpiry.getTime());
    // order.expiresAt = voucherExpiresAt + gracia (96h por default)
    const expectedOrderExpiresAt = fixedExpiry.getTime() + 96 * 60 * 60_000;
    expect(reloaded?.expiresAt?.getTime()).toBe(expectedOrderExpiresAt);

    const reservation = await StockReservation.findById(reloaded!.reservationId);
    // reservation.expiresAt = order.expiresAt + margen de seguridad (15 min)
    expect(reservation?.expiresAt.getTime()).toBe(expectedOrderExpiresAt + 15 * 60_000);
  });

  it("OXXO: envía el correo de ficha (§8 del plan de 1.6.3), y un replay NO lo reenvía", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.OXXO);
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    const provider = buildFakePaymentProvider({
      authorize: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo_email",
        status: "awaiting_customer",
        amountCents: 100000,
        currency: "mxn",
        voucher: { expiresAt: new Date("2026-02-01T05:59:00.000Z"), hostedVoucherUrl: "https://payments.stripe.com/oxxo/voucher/abc" },
      }),
    });

    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    // El correo se dispara `void` (fire-and-forget, a propósito: no debe
    // alargar la respuesta del checkout) — se espera a que el efecto
    // asíncrono termine en vez de asumir que ya corrió al volver el await.
    await vi.waitFor(() => expect(fake.calls).toHaveLength(1));
    expect(fake.calls[0]!.html).toContain("https://payments.stripe.com/oxxo/voucher/abc");

    // Replay: la orden ya tiene intentId, así que esta llamada solo
    // consulta (`getAuthorization`), nunca vuelve a llamar a
    // `persistPaymentIntent` — el correo no se reenvía.
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    expect(fake.calls).toHaveLength(1);
  });

  it("🔀 dos ensurePaymentIntent OXXO concurrentes: un solo correo de ficha", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.OXXO);
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    const provider = buildFakePaymentProvider({
      authorize: vi.fn().mockResolvedValue({
        intentId: "pi_oxxo_concurrent",
        status: "awaiting_customer",
        amountCents: 100000,
        currency: "mxn",
        voucher: { expiresAt: new Date("2026-02-01T05:59:00.000Z"), hostedVoucherUrl: "https://payments.stripe.com/oxxo/voucher/xyz" },
      }),
    });

    await Promise.all([
      ensurePaymentIntent(order._id.toString(), userId, { provider }),
      ensurePaymentIntent(order._id.toString(), userId, { provider }),
    ]);

    await vi.waitFor(() => expect(fake.calls).toHaveLength(1));
  });

  it("🔀 dos llamadas concurrentes guardan un solo intentId (Stripe ya devolvió el mismo PI por la idempotency key)", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider({
      authorize: vi.fn().mockResolvedValue({
        intentId: "pi_race",
        status: "awaiting_customer",
        amountCents: 100000,
        currency: "mxn",
        clientSecret: "pi_race_secret",
      }),
    });

    await Promise.all([
      ensurePaymentIntent(order._id.toString(), userId, { provider }),
      ensurePaymentIntent(order._id.toString(), userId, { provider }),
    ]);

    const reloaded = await Order.findById(order._id);
    expect(reloaded?.payment.intentId).toBe("pi_race");
  });

  it("orden ajena responde 404 (anti-IDOR)", async () => {
    const { order } = await createPendingOrder(PaymentMethod.CARD);
    const provider = buildFakePaymentProvider();

    await expect(
      ensurePaymentIntent(order._id.toString(), randomUserId(), { provider }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("orden ya pagada responde 409", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);
    await Order.updateOne({ _id: order._id }, { $set: { status: "paid" } });
    const provider = buildFakePaymentProvider();

    await expect(
      ensurePaymentIntent(order._id.toString(), userId, { provider }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("sin proveedor configurado responde 503", async () => {
    const { order, userId } = await createPendingOrder(PaymentMethod.CARD);

    await expect(
      ensurePaymentIntent(order._id.toString(), userId, { provider: undefined }),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});
