import { Types } from "mongoose";
import { AuthAction, MAX_ACCOUNT_CARD_DECLINES, MAX_CARD_FAILED_ATTEMPTS } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { User } from "../../src/models/user.model.js";
import { startSubscriptionForUser } from "../../src/services/subscription-start.service.js";
import { openEnrollment } from "../../src/services/subscription-enrollment.service.js";
import { updateSubscriptionSettings } from "../../src/services/settings.service.js";
import { recordAccountCardDecline } from "../../src/services/card-decline-guard.service.js";
import { seedPlanWithStripeRefs } from "../helpers/subscription-fixtures.js";
import { createOrder } from "../../src/services/order.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { recordCardPaymentFailure } from "../../src/services/card-payment-attempts.service.js";
import { AppError } from "../../src/utils/app-error.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { buildCreateOrderInput, randomUserId, resetCheckoutFixtureCounter, seedVariantWithStock } from "../helpers/checkout-fixtures.js";

const HOUR_MS = 60 * 60 * 1000;

/** Calco de `subscription-start.service.test.ts`: un día-ancla cuya próxima
 * ocurrencia cae el mes que viene, para que abrir la ventana nunca choque. */
function pickSafeAnchorDay(): number {
  const todayDay = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", day: "numeric" })
      .formatToParts(new Date())
      .find((part) => part.type === "day")?.value,
  );
  return todayDay > 1 ? Math.min(todayDay - 1, 28) : 28;
}

async function expectLocked(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).statusCode).toBe(429);
  expect((error as AppError).code).toBe("CARD_PAYMENTS_LOCKED");
}

async function lockAccount(userId: string, startedAt: Date = new Date()) {
  await User.updateOne({ _id: userId }, { $set: { cardDeclineWindow: { count: MAX_ACCOUNT_CARD_DECLINES, startedAt } } });
}

/**
 * Tope de rechazos de tarjeta POR CUENTA (auditoría run-2, hallazgo 7): el
 * tope de 5 por pedido se reiniciaba con cada pedido nuevo, así que una sola
 * cuenta podía probar tarjetas sin límite abriendo pedidos uno tras otro.
 */
describe("services/card-decline-guard — tope por cuenta entre pedidos", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
  });

  async function seedCustomer() {
    const userId = randomUserId();
    await User.create({
      _id: userId,
      email: `${userId}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });
    const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 50 });
    const lines = [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }];
    return { userId, lines };
  }

  // Un solo proveedor por test: el fake numera los PI por instancia y el
  // índice único de `payment.intentId` chocaría con dos instancias.
  let provider: ReturnType<typeof buildFakePaymentProvider>;
  beforeEach(() => {
    provider = buildFakePaymentProvider();
  });

  async function openPaidAttempt(userId: string, lines: Awaited<ReturnType<typeof seedCustomer>>["lines"]) {
    const input = await buildCreateOrderInput(userId, lines);
    const { order } = await createOrder(input);
    await ensurePaymentIntent(order._id.toString(), userId, { provider });
    return { order };
  }

  async function declineUntilClosed(orderId: string, tag: string) {
    for (let i = 0; i < MAX_CARD_FAILED_ATTEMPTS; i += 1) {
      await recordCardPaymentFailure({ orderId, eventId: `evt_${tag}_${i}`, provider });
    }
  }

  it("10 rechazos repartidos en 2 pedidos -> el tercer pedido responde 429 aunque cada pedido se reinicie en 0", async () => {
    const { userId, lines } = await seedCustomer();

    for (const tag of ["a", "b"]) {
      const { order } = await openPaidAttempt(userId, lines);
      await declineUntilClosed(order._id.toString(), tag);
    }

    const input = await buildCreateOrderInput(userId, lines);
    await expectLocked(createOrder(input));
  });

  it("reentregar el mismo eventId no suma doble al tope por cuenta", async () => {
    const { userId, lines } = await seedCustomer();
    const { order } = await openPaidAttempt(userId, lines);

    for (let i = 0; i < 3; i += 1) {
      await recordCardPaymentFailure({ orderId: order._id.toString(), eventId: "evt_repetido", provider });
    }

    const user = await User.findById(userId).select("+cardDeclineWindow").lean();
    expect(user?.cardDeclineWindow?.count).toBe(1);
  });

  it("con la cuenta bloqueada, reanudar el pago del pedido pendiente también responde 429", async () => {
    const { userId, lines } = await seedCustomer();
    const { order } = await openPaidAttempt(userId, lines);
    await lockAccount(userId);

    await expectLocked(ensurePaymentIntent(order._id.toString(), userId, { provider }));
  });

  it("al vencer la ventana el pedido vuelve a pasar y el siguiente rechazo abre una ventana nueva desde 1", async () => {
    const { userId, lines } = await seedCustomer();
    await lockAccount(userId, new Date(Date.now() - 25 * HOUR_MS));

    const { order } = await openPaidAttempt(userId, lines);
    await recordCardPaymentFailure({ orderId: order._id.toString(), eventId: "evt_nueva_ventana", provider });

    const user = await User.findById(userId).select("+cardDeclineWindow").lean();
    expect(user?.cardDeclineWindow?.count).toBe(1);
    expect(user?.cardDeclineWindow?.startedAt.getTime()).toBeGreaterThan(Date.now() - HOUR_MS);
  });
});

describe("services/card-decline-guard — recordAccountCardDecline", () => {
  it("audita CARD_PAYMENTS_LOCKED una sola vez, en el rechazo que llega al tope", async () => {
    const user = await User.create({
      email: `tope-${new Types.ObjectId().toString()}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });

    for (let i = 0; i < MAX_ACCOUNT_CARD_DECLINES + 3; i += 1) {
      await recordAccountCardDecline(user._id);
    }

    const audits = await AuditLog.countDocuments({ action: AuthAction.CARD_PAYMENTS_LOCKED, targetId: user._id });
    expect(audits).toBe(1);
  });

  it("🔀 diez rechazos concurrentes suman exactamente 10 y auditan una sola vez", async () => {
    const user = await User.create({
      email: `carrera-${new Types.ObjectId().toString()}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });

    await Promise.all(Array.from({ length: MAX_ACCOUNT_CARD_DECLINES }, () => recordAccountCardDecline(user._id)));

    const reloaded = await User.findById(user._id).select("+cardDeclineWindow").lean();
    expect(reloaded?.cardDeclineWindow?.count).toBe(MAX_ACCOUNT_CARD_DECLINES);
    expect(await AuditLog.countDocuments({ action: AuthAction.CARD_PAYMENTS_LOCKED, targetId: user._id })).toBe(1);
  });

  it("el estado del tope nunca viaja en una lectura normal de la usuaria", async () => {
    const user = await User.create({
      email: `oculto-${new Types.ObjectId().toString()}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });
    await recordAccountCardDecline(user._id);

    const plain = await User.findById(user._id).lean();
    expect(plain?.cardDeclineWindow).toBeUndefined();
  });
});

describe("services/card-decline-guard — alta de suscripción", () => {
  it("con la cuenta bloqueada, el alta responde 429 sin reclamar cupo", async () => {
    await updateSubscriptionSettings({ billingAnchorDay: pickSafeAnchorDay() });
    await openEnrollment({});
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const user = await User.create({
      email: `alta-${new Types.ObjectId().toString()}@example.com`,
      password: "Contrasena1",
      firstName: "Cliente",
      lastName: "Glow",
      role: "customer",
      emailVerified: true,
    });
    const userId = user._id.toString();
    await lockAccount(userId);

    await expectLocked(startSubscriptionForUser({ userId, planId: plan._id.toString() }));
    expect(await SubscriptionAccount.findOne({ userId })).toBeNull();
  });

  it("con un alta en curso, la rama replay tampoco devuelve el clientSecret si la cuenta se bloqueó después", async () => {
    await updateSubscriptionSettings({ billingAnchorDay: pickSafeAnchorDay() });
    await openEnrollment({});
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const user = await User.create({
      email: `replay-${new Types.ObjectId().toString()}@example.com`,
      password: "Contrasena1",
      firstName: "Cliente",
      lastName: "Glow",
      role: "customer",
      emailVerified: true,
    });
    const userId = user._id.toString();
    await startSubscriptionForUser({ userId, planId: plan._id.toString() });
    await lockAccount(userId);

    await expectLocked(startSubscriptionForUser({ userId, planId: plan._id.toString() }));
  });
});
