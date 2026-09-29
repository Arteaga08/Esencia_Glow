import { Types } from "mongoose";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { SubscriptionAccount } from "../../src/models/subscription-account.model.js";
import { User } from "../../src/models/user.model.js";
import { sendAnnualRenewalReminders } from "../../src/jobs/send-annual-renewal-reminders.js";
import { startSubscription, applyStatusTransition } from "../../src/services/subscription-seat.service.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { buildFakeMailProvider } from "../helpers/fake-mail-provider.js";
import { seedPlanWithStripeRefs } from "../helpers/subscription-fixtures.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-01T12:00:00Z");

/**
 * `sendAnnualRenewalReminders` (Milestone 2.7b) — aviso 30 días antes de que
 * se renueve un ciclo ANUAL (decisión de Manuel: un cobro recurrente sin
 * aviso es la causa #1 de contracargo). Claim atómico sobre
 * `renewalReminderSentFor` para no avisar dos veces del mismo período.
 */
describe("jobs/sendAnnualRenewalReminders", () => {
  async function seedAccount(fields: {
    billingInterval?: "month" | "year";
    status?: SubscriptionStatus;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    renewalReminderSentFor?: Date;
  }) {
    const userId = new Types.ObjectId();
    await User.create({
      _id: userId,
      email: `${userId.toString()}@example.com`,
      password: "P4ssword!!",
      firstName: "Ana",
      lastName: "Pérez",
      emailVerified: true,
    });
    const plan = await seedPlanWithStripeRefs({ annualPriceCents: 599000 });
    let account = await startSubscription({
      userId: userId.toString(),
      planId: plan._id.toString(),
      ...(fields.billingInterval ? { billingInterval: fields.billingInterval } : {}),
    });
    if (fields.status && fields.status !== SubscriptionStatus.INCOMPLETE) {
      account = await applyStatusTransition(account, SubscriptionStatus.ACTIVE, "system");
      if (fields.status !== SubscriptionStatus.ACTIVE) {
        const actor = fields.status === SubscriptionStatus.PAUSED ? "customer" : "system";
        account = await applyStatusTransition(account, fields.status, actor);
      }
    }
    await SubscriptionAccount.updateOne(
      { _id: account._id },
      {
        $set: {
          ...(fields.currentPeriodEnd ? { currentPeriodEnd: fields.currentPeriodEnd } : {}),
          ...(fields.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: fields.cancelAtPeriodEnd } : {}),
          ...(fields.renewalReminderSentFor ? { renewalReminderSentFor: fields.renewalReminderSentFor } : {}),
        },
      },
    );
    return (await SubscriptionAccount.findById(account._id))!;
  }

  it("avisa a una cuenta anual cuya renovación cae dentro de los próximos 30 días", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    const account = await seedAccount({
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: new Date(NOW.getTime() + 10 * DAY_MS),
    });

    const summary = await sendAnnualRenewalReminders(NOW);

    expect(summary.sent).toBe(1);
    expect(fake.calls).toHaveLength(1);
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.renewalReminderSentFor?.getTime()).toBe(reloaded?.currentPeriodEnd?.getTime());
  });

  it("NO avisa si la renovación está a más de 30 días", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    await seedAccount({
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: new Date(NOW.getTime() + 60 * DAY_MS),
    });

    const summary = await sendAnnualRenewalReminders(NOW);

    expect(summary.sent).toBe(0);
    expect(fake.calls).toHaveLength(0);
  });

  it("NO avisa dos veces del mismo período (idempotente entre ticks)", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    const periodEnd = new Date(NOW.getTime() + 10 * DAY_MS);
    await seedAccount({
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: periodEnd,
    });

    await sendAnnualRenewalReminders(NOW);
    const second = await sendAnnualRenewalReminders(NOW);

    expect(second.sent).toBe(0);
    expect(fake.calls).toHaveLength(1);
  });

  it("salta cuentas mensuales, canceladas, pausadas, past_due y con cancelAtPeriodEnd", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    const soon = new Date(NOW.getTime() + 10 * DAY_MS);

    await seedAccount({ status: SubscriptionStatus.ACTIVE, currentPeriodEnd: soon }); // mensual implícito
    await seedAccount({ billingInterval: "year", status: SubscriptionStatus.CANCELED, currentPeriodEnd: soon });
    await seedAccount({ billingInterval: "year", status: SubscriptionStatus.PAUSED, currentPeriodEnd: soon });
    await seedAccount({ billingInterval: "year", status: SubscriptionStatus.PAST_DUE, currentPeriodEnd: soon });
    await seedAccount({
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: soon,
      cancelAtPeriodEnd: true,
    });

    const summary = await sendAnnualRenewalReminders(NOW);

    expect(summary.sent).toBe(0);
    expect(fake.calls).toHaveLength(0);
  });

  it("ya avisada para OTRO período (renovó y arrancó un año nuevo): vuelve a avisar", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    const oldPeriodEnd = new Date(NOW.getTime() - 5 * DAY_MS);
    const newPeriodEnd = new Date(NOW.getTime() + 10 * DAY_MS);
    await seedAccount({
      billingInterval: "year",
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: newPeriodEnd,
      renewalReminderSentFor: oldPeriodEnd,
    });

    const summary = await sendAnnualRenewalReminders(NOW);

    expect(summary.sent).toBe(1);
  });
});
