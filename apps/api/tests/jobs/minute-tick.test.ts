import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sweeps = vi.hoisted(() => ({
  releaseExpiredReservations: vi.fn(),
  refreshBundleStockCaches: vi.fn(),
  cancelExpiredOrders: vi.fn(),
  reconcilePendingPayments: vi.fn(),
  expireIncompleteSubscriptions: vi.fn(),
  alertMissingEdition: vi.fn(),
  reconcilePendingPlanChanges: vi.fn(),
  createPrepaidCycleShipments: vi.fn(),
  sendRenewalReminders: vi.fn(),
}));
const loggerMock = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }));

vi.mock("../../src/jobs/release-expired-reservations.js", () => ({
  releaseExpiredReservations: sweeps.releaseExpiredReservations,
}));
vi.mock("../../src/jobs/refresh-bundle-stock-cache.js", () => ({
  refreshBundleStockCaches: sweeps.refreshBundleStockCaches,
}));
vi.mock("../../src/jobs/cancel-expired-orders.js", () => ({ cancelExpiredOrders: sweeps.cancelExpiredOrders }));
vi.mock("../../src/jobs/reconcile-pending-payments.js", () => ({
  reconcilePendingPayments: sweeps.reconcilePendingPayments,
}));
vi.mock("../../src/jobs/expire-incomplete-subscriptions.js", () => ({
  expireIncompleteSubscriptions: sweeps.expireIncompleteSubscriptions,
}));
vi.mock("../../src/jobs/alert-missing-edition.js", () => ({ alertMissingEdition: sweeps.alertMissingEdition }));
vi.mock("../../src/jobs/reconcile-pending-plan-changes.js", () => ({
  reconcilePendingPlanChanges: sweeps.reconcilePendingPlanChanges,
}));
vi.mock("../../src/jobs/create-prepaid-cycle-shipments.js", () => ({
  createPrepaidCycleShipments: sweeps.createPrepaidCycleShipments,
}));
vi.mock("../../src/jobs/send-renewal-reminders.js", () => ({ sendRenewalReminders: sweeps.sendRenewalReminders }));
vi.mock("../../src/services/settings.service.js", () => ({
  getSettings: vi.fn().mockResolvedValue({ inventory: { sweepBatchSize: 50 }, subscriptions: { billingAnchorDay: 1 } }),
}));
vi.mock("../../src/config/logger.js", () => ({ logger: loggerMock }));

import { getSettings } from "../../src/services/settings.service.js";
import { runMinuteTick } from "../../src/jobs/minute-tick.js";

const ok = { scanned: 0, released: 0, cancelled: 0, reconciled: 0, updated: 0, expired: 0, alerted: 0, finalized: 0, aborted: 0, created: 0, skipped: 0, sent: 0, failed: 0 };
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("runMinuteTick — aislamiento de barridos (auditoría run-2, hallazgo 15)", () => {
  const unhandled = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    for (const sweep of Object.values(sweeps)) sweep.mockResolvedValue({ ...ok });
    process.on("unhandledRejection", unhandled);
  });

  afterEach(() => {
    process.off("unhandledRejection", unhandled);
  });

  it("un barrido en paralelo que rechaza de inmediato no genera unhandledRejection y se registra", async () => {
    sweeps.releaseExpiredReservations.mockImplementation(async () => {
      await delay(50);
      return { ...ok };
    });
    sweeps.refreshBundleStockCaches.mockRejectedValue(new Error("fallo de red con Mongo"));

    await expect(runMinuteTick()).resolves.toBeUndefined();
    await delay(20); // 'unhandledRejection' se emite al drenar la cola de microtareas

    expect(unhandled).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ sweep: "refresh-bundle-stock-caches" }),
      expect.any(String),
    );
    expect(sweeps.cancelExpiredOrders).toHaveBeenCalledTimes(1);
  });

  it("si rechaza releaseExpiredReservations, los demás barridos igual corren y el tick no lanza", async () => {
    sweeps.releaseExpiredReservations.mockRejectedValue(new Error("fallo"));
    sweeps.reconcilePendingPayments.mockRejectedValue(new Error("otro fallo"));

    await expect(runMinuteTick()).resolves.toBeUndefined();
    await delay(20);

    expect(unhandled).not.toHaveBeenCalled();
    expect(sweeps.cancelExpiredOrders).toHaveBeenCalledTimes(1);
    expect(sweeps.sendRenewalReminders).toHaveBeenCalledTimes(1);
    expect(loggerMock.error).toHaveBeenCalledTimes(2);
  });

  it("si falla getSettings, el tick se omite sin lanzar, registra y no corre ningún barrido", async () => {
    vi.mocked(getSettings).mockRejectedValueOnce(new Error("Mongo caído"));

    await expect(runMinuteTick()).resolves.toBeUndefined();

    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    for (const sweep of Object.values(sweeps)) expect(sweep).not.toHaveBeenCalled();
  });
});
