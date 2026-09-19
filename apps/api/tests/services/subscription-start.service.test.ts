import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { AppError } from "../../src/utils/app-error.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import { User } from "../../src/models/user.model.js";
import { startSubscriptionForUser } from "../../src/services/subscription-start.service.js";
import { openEnrollment, closeEnrollment } from "../../src/services/subscription-enrollment.service.js";
import { updateSubscriptionSettings } from "../../src/services/settings.service.js";
import { __setSubscriptionProviderForTests } from "../../src/services/subscription-provider.js";
import { buildFakeSubscriptionProvider } from "../helpers/fake-subscription-provider.js";
import { seedPlanWithStripeRefs } from "../helpers/subscription-fixtures.js";

/**
 * Orquestación del endpoint de alta (Fase 4 de 1.7.2a, §E del plan): cupo
 * PRIMERO, Stripe después, con compensación explícita si Stripe falla tras
 * reclamar el cupo. `openEnrollment` (servicio real) abre la ventana en cada
 * test que la necesita — mismo criterio que `seedPlanWithStripeRefs` reusa
 * servicios reales en vez de escribir el documento a mano.
 */

/** Un día-ancla que garantiza que la PRÓXIMA ocurrencia caiga el mes que
 * viene (~27-31 días de margen, más que suficiente para el default de 15
 * días de ventana + el gap de 7) — calco de `pickSafeAnchorDay` en
 * `admin-subscription-enrollment.routes.test.ts`, para que abrir la ventana
 * con los defaults nunca choque con `assertWindowClearOfAnchor` sin
 * importar qué día del mes corra esta suite. */
function pickSafeAnchorDay(): number {
  const todayDay = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", day: "numeric" })
      .formatToParts(new Date())
      .find((part) => part.type === "day")?.value,
  );
  return todayDay > 1 ? todayDay - 1 : 28;
}

async function openEnrollmentSafely() {
  await updateSubscriptionSettings({ billingAnchorDay: pickSafeAnchorDay() });
  await openEnrollment({});
}

async function seedUser(overrides: Partial<{ email: string }> = {}) {
  const suffix = new Types.ObjectId().toString();
  const user = await User.create({
    email: overrides.email ?? `cliente-${suffix}@example.com`,
    password: "Contrasena1",
    firstName: "Cliente",
    lastName: "Glow",
    role: "customer",
    emailVerified: true,
  });
  return user._id.toString();
}

describe("services/subscription-start — golden path", () => {
  it("cupo primero, Stripe después: persiste refs, audita SUBSCRIPTION_STARTED y devuelve el DTO", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();

    const result = await startSubscriptionForUser({ userId, planId: plan._id.toString() });

    expect(result.clientSecret).toMatch(/^pi_fake_/);
    expect(result.firstChargeCents).toBe(59900);
    expect(result.currency).toBe("mxn");
    expect(new Date(result.nextChargeAt).getTime()).toBeGreaterThan(Date.now());

    const account = await SubscriptionAccount.findOne({ userId });
    expect(account?.status).toBe(SubscriptionStatus.INCOMPLETE);
    expect(account?.providerCustomerId).toMatch(/^cus_fake_/);
    expect(account?.providerSubscriptionId).toMatch(/^sub_fake_/);
    expect(account?.currentPeriodStart).toBeInstanceOf(Date);
    expect(account?.currentPeriodEnd).toBeInstanceOf(Date);

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(1);

    const audit = await AuditLog.findOne({ action: "subscription_started", targetId: account?._id });
    expect(audit).not.toBeNull();
  });

  it("dos altas del MISMO usuario usan idempotencyKeys de Stripe distintas (discriminador seatHeldAt)", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();

    const fake = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(fake);

    await startSubscriptionForUser({ userId, planId: plan._id.toString() });
    const account = await SubscriptionAccount.findOne({ userId });
    // Cancela para habilitar la re-alta (CANCELED -> INCOMPLETE, mismo doc).
    const { applyStatusTransition } = await import("../../src/services/subscription-seat.service.js");
    await applyStatusTransition(account!, SubscriptionStatus.CANCELED, "system");

    await startSubscriptionForUser({ userId, planId: plan._id.toString() });

    const startSubscriptionMock = fake.startSubscription as ReturnType<typeof vi.fn>;
    expect(startSubscriptionMock).toHaveBeenCalledTimes(2);
    const [firstCall] = startSubscriptionMock.mock.calls[0]!;
    const [secondCall] = startSubscriptionMock.mock.calls[1]!;
    expect(firstCall.idempotencyKey).not.toBe(secondCall.idempotencyKey);
  });

  it("una re-alta reusa el providerCustomerId existente, sin llamar a ensureCustomer de nuevo", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();

    const fake = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(fake);

    await startSubscriptionForUser({ userId, planId: plan._id.toString() });
    const account = await SubscriptionAccount.findOne({ userId });
    const { applyStatusTransition } = await import("../../src/services/subscription-seat.service.js");
    await applyStatusTransition(account!, SubscriptionStatus.CANCELED, "system");

    await startSubscriptionForUser({ userId, planId: plan._id.toString() });

    expect(fake.ensureCustomer).toHaveBeenCalledTimes(1);
    const reloaded = await SubscriptionAccount.findOne({ userId });
    expect(reloaded?.providerCustomerId).toBe(account?.providerCustomerId);
  });
});

describe("services/subscription-start — rama replay", () => {
  it("segunda llamada mientras sigue INCOMPLETE con ref -> mismo clientSecret, sin reclamar cupo ni llamar a Stripe de nuevo", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();

    const fake = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(fake);

    const first = await startSubscriptionForUser({ userId, planId: plan._id.toString() });
    const second = await startSubscriptionForUser({ userId, planId: plan._id.toString() });

    expect(second.clientSecret).toBe(first.clientSecret);
    expect(fake.startSubscription).toHaveBeenCalledTimes(1);
    expect(fake.getSubscription).toHaveBeenCalledTimes(1);

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(1);
  });
});

describe("services/subscription-start — compensación", () => {
  it("Stripe falla tras reclamar el cupo -> el error se relanza, el cupo se libera y la cuenta queda CANCELED", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();

    __setSubscriptionProviderForTests(
      buildFakeSubscriptionProvider({
        startSubscription: vi.fn().mockRejectedValue(new AppError("stripe caído", 502)),
      }),
    );

    await expect(startSubscriptionForUser({ userId, planId: plan._id.toString() })).rejects.toMatchObject({
      statusCode: 502,
    });

    const account = await SubscriptionAccount.findOne({ userId });
    expect(account?.status).toBe(SubscriptionStatus.CANCELED);

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(0);
  });

  it("ensureCustomer falla tras reclamar el cupo -> misma compensación", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();

    __setSubscriptionProviderForTests(
      buildFakeSubscriptionProvider({
        ensureCustomer: vi.fn().mockRejectedValue(new AppError("stripe caído", 502)),
      }),
    );

    await expect(startSubscriptionForUser({ userId, planId: plan._id.toString() })).rejects.toMatchObject({
      statusCode: 502,
    });

    const account = await SubscriptionAccount.findOne({ userId });
    expect(account?.status).toBe(SubscriptionStatus.CANCELED);
    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(0);
  });
});

describe("services/subscription-start — guardas de negocio, cupo intacto", () => {
  it("ventana de inscripciones cerrada -> 409, sin tocar cupo ni Stripe", async () => {
    await closeEnrollment();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();

    const fake = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(fake);

    await expect(startSubscriptionForUser({ userId, planId: plan._id.toString() })).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(fake.startSubscription).not.toHaveBeenCalled();
    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(0);
  });

  it("plan inactivo -> 409, sin tocar cupo", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    await SubscriptionPlan.updateOne({ _id: plan._id }, { $set: { isActive: false } });
    const userId = await seedUser();

    await expect(startSubscriptionForUser({ userId, planId: plan._id.toString() })).rejects.toMatchObject({
      statusCode: 409,
    });

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(0);
  });

  it("plan sin providerPriceId -> 409, sin tocar cupo", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    await SubscriptionPlan.updateOne({ _id: plan._id }, { $unset: { providerPriceId: 1 } });
    const userId = await seedUser();

    await expect(startSubscriptionForUser({ userId, planId: plan._id.toString() })).rejects.toMatchObject({
      statusCode: 409,
    });

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(0);
  });

  it("plan agotado -> 409 (el cupo llega al tope antes de llamar a Stripe)", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 1 });
    const takerUserId = await seedUser();
    await startSubscriptionForUser({ userId: takerUserId, planId: plan._id.toString() });

    const fake = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(fake);
    const loserUserId = await seedUser();

    await expect(
      startSubscriptionForUser({ userId: loserUserId, planId: plan._id.toString() }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(fake.startSubscription).not.toHaveBeenCalled();
  });

  it("usuaria ya suscrita (ACTIVE) -> 409, sin tocar cupo ni llamar a Stripe", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();
    await startSubscriptionForUser({ userId, planId: plan._id.toString() });
    const account = await SubscriptionAccount.findOne({ userId });
    const { applyStatusTransition } = await import("../../src/services/subscription-seat.service.js");
    await applyStatusTransition(account!, SubscriptionStatus.ACTIVE, "system");

    const fake = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(fake);

    await expect(startSubscriptionForUser({ userId, planId: plan._id.toString() })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(fake.startSubscription).not.toHaveBeenCalled();

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(1);
  });
});

describe("services/subscription-start — concurrencia real", () => {
  it("10 altas simultáneas sobre un plan de 3 -> exactamente 3 fulfilled, fake.startSubscription llamado exactamente 3 veces", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 3 });
    const fake = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(fake);

    const userIds = await Promise.all(Array.from({ length: 10 }, () => seedUser()));

    const results = await Promise.allSettled(
      userIds.map((userId) => startSubscriptionForUser({ userId, planId: plan._id.toString() })),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(3);
    expect(fake.startSubscription).toHaveBeenCalledTimes(3);

    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(3);
  }, 30_000);
});

describe("services/subscription-start — replay con OTRO plan", () => {
  it("una cuenta INCOMPLETE del plan A pidiendo el plan B -> 409, nunca el clientSecret del plan viejo", async () => {
    await openEnrollmentSafely();
    const planA = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const planB = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();

    const fake = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(fake);

    const first = await startSubscriptionForUser({ userId, planId: planA._id.toString() });

    await expect(startSubscriptionForUser({ userId, planId: planB._id.toString() })).rejects.toMatchObject({
      statusCode: 409,
    });
    // El clientSecret del plan A jamás se devolvió bajo la petición del plan B.
    expect(first.clientSecret).toBeDefined();
    expect(fake.getSubscription).not.toHaveBeenCalled();
  });
});

describe("services/subscription-start — clientSecret muerto", () => {
  it("replay de una suscripción que Stripe ya canceló -> 409, nunca un clientSecret que no puede confirmarse", async () => {
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();

    const fake = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(fake);
    await startSubscriptionForUser({ userId, planId: plan._id.toString() });

    // Stripe expiró la suscripción entre el alta y el replay: el
    // `clientSecret` sigue viajando en la respuesta pero ya no confirma nada.
    const account = await SubscriptionAccount.findOne({ userId });
    __setSubscriptionProviderForTests(
      buildFakeSubscriptionProvider({
        getSubscription: vi.fn().mockResolvedValue({
          subscriptionRef: account!.providerSubscriptionId!,
          status: "canceled",
          clientSecret: "pi_muerto_secret",
          firstChargeCents: 59900,
          currency: "mxn",
          nextChargeAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        }),
      }),
    );

    await expect(startSubscriptionForUser({ userId, planId: plan._id.toString() })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("services/subscription-start — Stripe activa la suscripción de inmediato", () => {
  it("un alta que Stripe devuelve ya 'active' NO se compensa: la clienta quedaría cobrada sin cuenta local", async () => {
    // Hallazgo de code review: la guarda de `status` pertenece a la rama
    // replay. En el camino de CREACIÓN, lanzar dispara `compensateFailedStart`,
    // que cancela la cuenta local y libera el cupo pero NO cancela nada en
    // Stripe — la suscripción seguiría cobrando cada mes sin cuenta local.
    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();

    const fake = buildFakeSubscriptionProvider({
      startSubscription: vi.fn().mockResolvedValue({
        subscriptionRef: "sub_ya_activa",
        status: "active",
        clientSecret: "pi_activa_secret",
        firstChargeCents: 0,
        currency: "mxn",
        nextChargeAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      }),
    });
    __setSubscriptionProviderForTests(fake);

    await startSubscriptionForUser({ userId, planId: plan._id.toString() });

    const account = await SubscriptionAccount.findOne({ userId });
    expect(account?.status).not.toBe(SubscriptionStatus.CANCELED);
    expect(account?.providerSubscriptionId).toBe("sub_ya_activa");
    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(1);
  });
});
