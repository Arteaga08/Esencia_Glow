import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { AppError } from "../../src/utils/app-error.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { SubscriptionPlan } from "../../src/models/subscription-plan.model.js";
import {
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  undoCancelSubscription,
} from "../../src/services/subscription-self-service.service.js";
import { __setSubscriptionProviderForTests } from "../../src/services/subscription-provider.js";
import type { SubscriptionProvider } from "../../src/services/subscription-provider.js";
import { buildFakeSubscriptionProvider } from "../helpers/fake-subscription-provider.js";
import { seedManaged } from "../helpers/subscription-fixtures.js";

/**
 * Autoservicio de la suscriptora (Milestone 1.7.3): pausar, reanudar,
 * cancelar y deshacer la cancelación. Regla de orden bajo prueba: el paso que
 * puede fallar sin poder deshacerse va primero, y toda compensación es un
 * paso que siempre funciona (soltar cupo, reenviar a Stripe un valor
 * idempotente) — nunca deja al proveedor contradiciendo a la base de forma
 * irrecuperable.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

let provider: SubscriptionProvider;

function useProvider(overrides: Partial<SubscriptionProvider> = {}): SubscriptionProvider {
  provider = buildFakeSubscriptionProvider(overrides);
  __setSubscriptionProviderForTests(provider);
  return provider;
}

beforeEach(() => {
  useProvider();
});

async function reload(accountId: unknown) {
  return SubscriptionAccount.findById(accountId);
}

async function seatsTaken(planId: string): Promise<number> {
  return (await SubscriptionPlan.findById(planId))!.seatsTaken;
}

describe("subscription-self-service — pausar", () => {
  it("camino feliz: pausa en Stripe, transiciona ACTIVE->PAUSED, sella pausedAt, libera el cupo y audita", async () => {
    const { planId, subscriptionRef, userId, accountId } = await seedManaged();
    expect(await seatsTaken(planId)).toBe(1);

    await pauseSubscription(userId);

    expect(provider.pauseCollection).toHaveBeenCalledWith({ subscriptionRef });
    const account = await reload(accountId);
    expect(account?.status).toBe(SubscriptionStatus.PAUSED);
    expect(account?.pausedAt).toBeInstanceOf(Date);
    expect(await seatsTaken(planId)).toBe(0);
    expect(await AuditLog.countDocuments({ action: "subscription_paused", targetId: accountId })).toBe(1);
  });

  it("sin suscripción -> 404, Stripe no se toca", async () => {
    await expect(pauseSubscription("aaaaaaaaaaaaaaaaaaaaaaaa")).rejects.toMatchObject({ statusCode: 404 });
    expect(provider.pauseCollection).not.toHaveBeenCalled();
  });

  it.each([SubscriptionStatus.PAST_DUE, SubscriptionStatus.PAUSED, SubscriptionStatus.INCOMPLETE])(
    "estado %s -> 409 sin llamar a Stripe (solo se pausa una suscripción ACTIVE)",
    async (status) => {
      const { userId } = await seedManaged({ status });

      await expect(pauseSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });
      expect(provider.pauseCollection).not.toHaveBeenCalled();
    },
  );

  it("corte de 48 h: a menos de 48 h del siguiente cobro -> 409 sin llamar a Stripe", async () => {
    const { userId, accountId } = await seedManaged({ periodEndInDays: 1 });

    await expect(pauseSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.pauseCollection).not.toHaveBeenCalled();
    expect((await reload(accountId))?.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it("justo por encima del corte (3 días) SÍ deja pausar", async () => {
    const { userId, accountId } = await seedManaged({ periodEndInDays: 3 });

    await pauseSubscription(userId);

    expect((await reload(accountId))?.status).toBe(SubscriptionStatus.PAUSED);
  });

  it("con cancelAtPeriodEnd pendiente -> 409 (primero hay que deshacer la cancelación)", async () => {
    const { userId } = await seedManaged({ cancelAtPeriodEnd: true });

    await expect(pauseSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.pauseCollection).not.toHaveBeenCalled();
  });

  it("con un cambio de plan en curso -> 409", async () => {
    const { userId, accountId, planId } = await seedManaged();
    await SubscriptionAccount.updateOne(
      { _id: accountId },
      { $set: { pendingPlanChange: { planId, requestedAt: new Date() } } },
    );

    await expect(pauseSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.pauseCollection).not.toHaveBeenCalled();
  });

  it("si un webhook mueve la cuenta a PAST_DUE ENTRE la llamada a Stripe y la escritura local: compensa (reanuda en Stripe) y relanza el 409 original", async () => {
    const { userId, accountId } = await seedManaged();
    useProvider({
      pauseCollection: vi.fn().mockImplementation(async ({ subscriptionRef }: { subscriptionRef: string }) => {
        await SubscriptionAccount.updateOne({ _id: accountId }, { $set: { status: SubscriptionStatus.PAST_DUE } });
        return { subscriptionRef, status: "active", collectionPaused: true, cancelAtPeriodEnd: false };
      }),
    });

    await expect(pauseSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });

    expect(provider.resumeCollection).toHaveBeenCalledTimes(1);
    expect((await reload(accountId))?.status).toBe(SubscriptionStatus.PAST_DUE);
  });

  it("si la compensación TAMBIÉN falla: relanza el error original y audita PROVIDER_MISMATCH", async () => {
    const { userId, accountId } = await seedManaged();
    useProvider({
      pauseCollection: vi.fn().mockImplementation(async ({ subscriptionRef }: { subscriptionRef: string }) => {
        await SubscriptionAccount.updateOne({ _id: accountId }, { $set: { status: SubscriptionStatus.PAST_DUE } });
        return { subscriptionRef, status: "active", collectionPaused: true, cancelAtPeriodEnd: false };
      }),
      resumeCollection: vi.fn().mockRejectedValue(new AppError("Stripe caído", 502)),
    });

    await expect(pauseSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });

    expect(
      await AuditLog.countDocuments({ action: "subscription_provider_mismatch", targetId: accountId }),
    ).toBe(1);
  });

  it("si Stripe falla al pausar: no se toca la base y el error sube", async () => {
    const { userId, accountId, planId } = await seedManaged();
    useProvider({ pauseCollection: vi.fn().mockRejectedValue(new AppError("Stripe caído", 502)) });

    await expect(pauseSubscription(userId)).rejects.toMatchObject({ statusCode: 502 });

    expect((await reload(accountId))?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(await seatsTaken(planId)).toBe(1);
  });
});

describe("subscription-self-service — reanudar", () => {
  it("camino feliz: reclama cupo, reanuda en Stripe, refresca el período, limpia pausedAt y audita", async () => {
    const { planId, subscriptionRef, userId, accountId } = await seedManaged({
      status: SubscriptionStatus.PAUSED,
      pausedAt: new Date(),
    });
    expect(await seatsTaken(planId)).toBe(0);
    const freshEnd = new Date(Date.now() + 25 * DAY_MS);
    useProvider({
      resumeCollection: vi.fn().mockResolvedValue({
        subscriptionRef,
        status: "active",
        collectionPaused: false,
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(),
        currentPeriodEnd: freshEnd,
      }),
    });

    await resumeSubscription(userId);

    const account = await reload(accountId);
    expect(account?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(account?.pausedAt).toBeUndefined();
    expect(account?.currentPeriodEnd?.getTime()).toBe(freshEnd.getTime());
    expect(await seatsTaken(planId)).toBe(1);
    expect(await AuditLog.countDocuments({ action: "subscription_resumed", targetId: accountId })).toBe(1);
  });

  it("plan lleno: 409 y Stripe NUNCA se toca (el cupo se reclama primero)", async () => {
    const { planId, userId, accountId } = await seedManaged({ status: SubscriptionStatus.PAUSED, maxActiveSeats: 1 });
    // Otra clienta toma el único lugar mientras esta estaba pausada.
    await seedManaged({ planId, status: SubscriptionStatus.ACTIVE });
    expect(await seatsTaken(planId)).toBe(1);

    await expect(resumeSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });

    expect(provider.resumeCollection).not.toHaveBeenCalled();
    expect((await reload(accountId))?.status).toBe(SubscriptionStatus.PAUSED);
    expect(await seatsTaken(planId)).toBe(1);
  });

  it("si Stripe falla al reanudar y CONFIRMA que sigue pausado: vuelve a PAUSED, libera el cupo y conserva pausedAt", async () => {
    const pausedAt = new Date(Date.now() - 2 * DAY_MS);
    const { planId, subscriptionRef, userId, accountId } = await seedManaged({ status: SubscriptionStatus.PAUSED, pausedAt });
    useProvider({
      resumeCollection: vi.fn().mockRejectedValue(new AppError("Stripe caído", 502)),
      getSubscription: vi.fn().mockResolvedValue({
        subscriptionRef,
        status: "active",
        collectionPaused: true,
        cancelAtPeriodEnd: false,
      }),
    });

    await expect(resumeSubscription(userId)).rejects.toMatchObject({ statusCode: 502 });

    const account = await reload(accountId);
    expect(account?.status).toBe(SubscriptionStatus.PAUSED);
    expect(account?.pausedAt?.getTime()).toBe(pausedAt.getTime());
    expect(await seatsTaken(planId)).toBe(0);
  });

  it("error AMBIGUO al reanudar (timeout) pero Stripe SÍ reanudó: se trata como éxito — volver a PAUSED cobraría a la clienta sin generar caja", async () => {
    const { planId, subscriptionRef, userId, accountId } = await seedManaged({
      status: SubscriptionStatus.PAUSED,
      pausedAt: new Date(),
    });
    useProvider({
      resumeCollection: vi.fn().mockRejectedValue(new AppError("Timeout", 502)),
      getSubscription: vi.fn().mockResolvedValue({
        subscriptionRef,
        status: "active",
        collectionPaused: false,
        cancelAtPeriodEnd: false,
      }),
    });

    await expect(resumeSubscription(userId)).resolves.toBeUndefined();

    expect((await reload(accountId))?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(await seatsTaken(planId)).toBe(1);
    expect(await AuditLog.countDocuments({ action: "subscription_resumed", targetId: accountId })).toBe(1);
  });

  it("error al reanudar Y no se puede consultar a Stripe: la cuenta se queda ACTIVE (peor es cobrar sin caja), audita PROVIDER_MISMATCH y relanza el error original", async () => {
    const { planId, userId, accountId } = await seedManaged({ status: SubscriptionStatus.PAUSED, pausedAt: new Date() });
    useProvider({
      resumeCollection: vi.fn().mockRejectedValue(new AppError("Timeout", 502)),
      getSubscription: vi.fn().mockRejectedValue(new AppError("Stripe caído", 502)),
    });

    await expect(resumeSubscription(userId)).rejects.toMatchObject({ statusCode: 502, message: "Timeout" });

    expect((await reload(accountId))?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(await seatsTaken(planId)).toBe(1);
    expect(await AuditLog.countDocuments({ action: "subscription_provider_mismatch", targetId: accountId })).toBe(1);
  });

  it("la suscripción ya no existe/está cancelada en Stripe al reanudar: vuelve a PAUSED y el .deleted la converge", async () => {
    const { planId, subscriptionRef, userId, accountId } = await seedManaged({
      status: SubscriptionStatus.PAUSED,
      pausedAt: new Date(),
    });
    useProvider({
      resumeCollection: vi.fn().mockRejectedValue(new AppError("La suscripción ya no admite ese cambio.", 409)),
      getSubscription: vi.fn().mockResolvedValue({
        subscriptionRef,
        status: "canceled",
        collectionPaused: false,
        cancelAtPeriodEnd: false,
      }),
    });

    await expect(resumeSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });

    expect((await reload(accountId))?.status).toBe(SubscriptionStatus.PAUSED);
    expect(await seatsTaken(planId)).toBe(0);
  });

  it.each([SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.CANCELED])(
    "estado %s -> 409 (solo se reanuda una suscripción PAUSED)",
    async (status) => {
      const { userId } = await seedManaged({ status });

      await expect(resumeSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });
      expect(provider.resumeCollection).not.toHaveBeenCalled();
    },
  );
});

describe("subscription-self-service — cancelar", () => {
  it("ACTIVE: marca cancelAtPeriodEnd en Stripe y localmente, con motivo; NO cambia el estado ni el cupo", async () => {
    const { planId, subscriptionRef, userId, accountId } = await seedManaged();

    const outcome = await cancelSubscription(userId, "Me mudo de ciudad");

    expect(outcome).toBe("scheduled");
    expect(provider.setCancelAtPeriodEnd).toHaveBeenCalledWith({
      subscriptionRef,
      cancelAtPeriodEnd: true,
      comment: "Me mudo de ciudad",
    });
    const account = await reload(accountId);
    expect(account?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(account?.cancelAtPeriodEnd).toBe(true);
    expect(account?.cancelReason).toBe("Me mudo de ciudad");
    expect(account?.cancelRequestedAt).toBeInstanceOf(Date);
    expect(await seatsTaken(planId)).toBe(1);
    expect(await AuditLog.countDocuments({ action: "subscription_cancel_scheduled", targetId: accountId })).toBe(1);
  });

  it("PAST_DUE también puede programar la cancelación (justo cuando quien se quiere salir)", async () => {
    const { userId, accountId } = await seedManaged({ status: SubscriptionStatus.PAST_DUE });

    expect(await cancelSubscription(userId)).toBe("scheduled");

    expect((await reload(accountId))?.cancelAtPeriodEnd).toBe(true);
  });

  it("sin motivo no manda comment a Stripe ni escribe cancelReason", async () => {
    const { subscriptionRef, userId, accountId } = await seedManaged();

    await cancelSubscription(userId);

    expect(provider.setCancelAtPeriodEnd).toHaveBeenCalledWith({ subscriptionRef, cancelAtPeriodEnd: true });
    expect((await reload(accountId))?.cancelReason).toBeUndefined();
  });

  it("ya programada: es idempotente — reenvía a Stripe (repara divergencias), 'scheduled', sin segundo audit ni pisar el motivo", async () => {
    const { userId, accountId } = await seedManaged();
    await cancelSubscription(userId, "Primer motivo");

    const outcome = await cancelSubscription(userId, "Otro motivo");

    expect(outcome).toBe("scheduled");
    expect(provider.setCancelAtPeriodEnd).toHaveBeenCalledTimes(2);
    expect((await reload(accountId))?.cancelReason).toBe("Primer motivo");
    expect(await AuditLog.countDocuments({ action: "subscription_cancel_scheduled", targetId: accountId })).toBe(1);
  });

  it("si la escritura local pierde (la cuenta ya no es ACTIVE/PAST_DUE): compensa cancelAtPeriodEnd=false en Stripe y da 409", async () => {
    const { userId, accountId } = await seedManaged();
    useProvider({
      setCancelAtPeriodEnd: vi.fn().mockImplementation(async (input: { subscriptionRef: string; cancelAtPeriodEnd: boolean }) => {
        if (input.cancelAtPeriodEnd) {
          await SubscriptionAccount.updateOne({ _id: accountId }, { $set: { status: SubscriptionStatus.CANCELED } });
        }
        return { subscriptionRef: input.subscriptionRef, status: "active", collectionPaused: false, cancelAtPeriodEnd: input.cancelAtPeriodEnd };
      }),
    });

    await expect(cancelSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });

    expect(provider.setCancelAtPeriodEnd).toHaveBeenLastCalledWith(
      expect.objectContaining({ cancelAtPeriodEnd: false }),
    );
  });

  it("con un cambio de plan en curso -> 409 sin llamar a Stripe", async () => {
    const { userId, accountId, planId } = await seedManaged();
    await SubscriptionAccount.updateOne(
      { _id: accountId },
      { $set: { pendingPlanChange: { planId, requestedAt: new Date() } } },
    );

    await expect(cancelSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.setCancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it("PAUSED: cancela de inmediato en Stripe (idempotencyKey por pausedAt) y transiciona a CANCELED sin tocar el cupo", async () => {
    const pausedAt = new Date(Date.now() - DAY_MS);
    const { planId, subscriptionRef, userId, accountId } = await seedManaged({
      status: SubscriptionStatus.PAUSED,
      pausedAt,
    });

    const outcome = await cancelSubscription(userId, "Ya no la uso");

    expect(outcome).toBe("canceled");
    expect(provider.cancelNow).toHaveBeenCalledWith({
      subscriptionRef,
      comment: "Ya no la uso",
      idempotencyKey: `account:${accountId.toString()}:cancel:${pausedAt.getTime()}`,
    });
    const account = await reload(accountId);
    expect(account?.status).toBe(SubscriptionStatus.CANCELED);
    expect(account?.canceledAt).toBeInstanceOf(Date);
    expect(account?.cancelReason).toBe("Ya no la uso");
    expect(account?.pausedAt).toBeUndefined();
    expect(await seatsTaken(planId)).toBe(0);
    expect(await AuditLog.countDocuments({ action: "subscription_canceled", targetId: accountId })).toBe(1);
  });

  it("PAUSED con la escritura local perdida PERO ya convergida por el webhook (.deleted): devuelve 'canceled' sin error", async () => {
    const { userId, accountId } = await seedManaged({ status: SubscriptionStatus.PAUSED, pausedAt: new Date() });
    useProvider({
      cancelNow: vi.fn().mockImplementation(async ({ subscriptionRef }: { subscriptionRef: string }) => {
        // El webhook `.deleted` llega antes de que terminemos nuestra escritura.
        await SubscriptionAccount.updateOne({ _id: accountId }, { $set: { status: SubscriptionStatus.CANCELED } });
        return { subscriptionRef, status: "canceled", collectionPaused: false, cancelAtPeriodEnd: false };
      }),
    });

    await expect(cancelSubscription(userId)).resolves.toBe("canceled");
  });

  it("PAUSED con Stripe ya cancelado pero la escritura local rota: NO compensa (cancelar es final) y el error sube", async () => {
    const { userId, accountId } = await seedManaged({ status: SubscriptionStatus.PAUSED, pausedAt: new Date() });
    useProvider({
      cancelNow: vi.fn().mockImplementation(async ({ subscriptionRef }: { subscriptionRef: string }) => {
        // Otro escritor la mueve a un estado que no es PAUSED ni CANCELED.
        await SubscriptionAccount.updateOne({ _id: accountId }, { $set: { status: SubscriptionStatus.ACTIVE } });
        return { subscriptionRef, status: "canceled", collectionPaused: false, cancelAtPeriodEnd: false };
      }),
    });

    await expect(cancelSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });

    // Nada intentó "des-cancelar" en Stripe: no existe tal operación.
    expect(provider.resumeCollection).not.toHaveBeenCalled();
    expect(provider.setCancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it.each([SubscriptionStatus.INCOMPLETE, SubscriptionStatus.CANCELED])("estado %s -> 409", async (status) => {
    const { userId } = await seedManaged({ status });

    await expect(cancelSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.setCancelAtPeriodEnd).not.toHaveBeenCalled();
    expect(provider.cancelNow).not.toHaveBeenCalled();
  });
});

describe("subscription-self-service — deshacer cancelación", () => {
  it("camino feliz: quita cancelAtPeriodEnd en Stripe y localmente, limpia cancelRequestedAt/cancelReason y audita", async () => {
    const { subscriptionRef, userId, accountId } = await seedManaged();
    await cancelSubscription(userId, "Me arrepiento pronto");

    await undoCancelSubscription(userId);

    expect(provider.setCancelAtPeriodEnd).toHaveBeenLastCalledWith({ subscriptionRef, cancelAtPeriodEnd: false });
    const account = await reload(accountId);
    expect(account?.cancelAtPeriodEnd).toBe(false);
    expect(account?.cancelRequestedAt).toBeUndefined();
    expect(account?.cancelReason).toBeUndefined();
    expect(await AuditLog.countDocuments({ action: "subscription_cancel_undone", targetId: accountId })).toBe(1);
  });

  it("sin cancelación pendiente -> 409 sin llamar a Stripe", async () => {
    const { userId } = await seedManaged();

    await expect(undoCancelSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(provider.setCancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it("el período ya venció -> 409 'ya terminó' sin llamar a Stripe", async () => {
    const { userId } = await seedManaged({ cancelAtPeriodEnd: true, periodEndInDays: -1 });

    await expect(undoCancelSubscription(userId)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("terminó"),
    });
    expect(provider.setCancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it("si Stripe responde que la suscripción ya no admite el cambio (carrera con el fin del período): 409 'ya terminó', la base no cambia", async () => {
    const { userId, accountId } = await seedManaged({ cancelAtPeriodEnd: true });
    useProvider({ setCancelAtPeriodEnd: vi.fn().mockRejectedValue(new AppError("La suscripción ya no admite ese cambio.", 409)) });

    await expect(undoCancelSubscription(userId)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("terminó"),
    });

    expect((await reload(accountId))?.cancelAtPeriodEnd).toBe(true);
  });

  it("si la escritura local pierde: compensa volviendo a marcar cancelAtPeriodEnd=true en Stripe y da 409", async () => {
    const { userId, accountId } = await seedManaged({ cancelAtPeriodEnd: true });
    useProvider({
      setCancelAtPeriodEnd: vi.fn().mockImplementation(async (input: { subscriptionRef: string; cancelAtPeriodEnd: boolean }) => {
        if (!input.cancelAtPeriodEnd) {
          await SubscriptionAccount.updateOne({ _id: accountId }, { $set: { status: SubscriptionStatus.CANCELED } });
        }
        return { subscriptionRef: input.subscriptionRef, status: "active", collectionPaused: false, cancelAtPeriodEnd: input.cancelAtPeriodEnd };
      }),
    });

    await expect(undoCancelSubscription(userId)).rejects.toMatchObject({ statusCode: 409 });

    expect(provider.setCancelAtPeriodEnd).toHaveBeenLastCalledWith(
      expect.objectContaining({ cancelAtPeriodEnd: true }),
    );
  });
});
