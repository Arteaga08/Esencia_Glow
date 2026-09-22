import {
  DisputeStatus,
  LABEL_BACKOFF_BASE_MINUTES,
  LABEL_MAX_ATTEMPTS,
  OrderStatus,
  ShippingCarrier,
  ShippingLabelStatus,
} from "@esencia-glow/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { logger } from "../../src/config/logger.js";
import { Order } from "../../src/models/order.model.js";
import { Settings } from "../../src/models/settings.model.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { processOrderLabel } from "../../src/services/order-label.service.js";
import { ShippingProviderError, __setShippingProviderForTests } from "../../src/services/shipping-provider.js";
import type { ShippingLabelResult } from "../../src/services/shipping-provider.js";
import { __setAdminAlertEmailForTests } from "../../src/services/subscription-email.service.js";
import { resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";
import { buildFakeMailProvider } from "../helpers/fake-mail-provider.js";
import { buildFakeShippingProvider } from "../helpers/fake-shipping-provider.js";
import { SHIPPING_ORIGIN, seedPaidOrder, seedShippingOrigin } from "../helpers/paid-order-fixtures.js";

const MINUTE = 60_000;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function waitForLabelStatus(orderId: string, status: ShippingLabelStatus) {
  for (let i = 0; i < 200; i += 1) {
    const order = await Order.findById(orderId).lean();
    if (order?.label?.status === status) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`La guía nunca llegó a ${status}`);
}

/**
 * `processOrderLabel` — compra de la guía DESPUÉS del pago (1.9). Una guía se
 * paga con créditos prepagados: la garantía central es que jamás se compre
 * dos veces, ni por concurrencia, ni por un reintento tras una respuesta
 * dudosa, ni por una respuesta tardía de un intento viejo.
 */
describe("services/order-label — processOrderLabel", () => {
  beforeEach(async () => {
    resetCheckoutFixtureCounter();
    await seedShippingOrigin();
  });

  const readyResult = (orderId: string): ShippingLabelResult => ({
    status: "ready",
    providerShipmentId: `ship-${orderId}`,
    trackingNumber: `TRK-${orderId}`,
    carrier: ShippingCarrier.FEDEX,
    labelUrl: "https://labels.example/1.pdf",
    trackingUrl: "https://track.example/1",
  });

  describe("compra exitosa", () => {
    it("compra UNA vez con los datos correctos, deja la guía ready y mueve la orden a processing", async () => {
      const { orderId } = await seedPaidOrder();
      const provider = buildFakeShippingProvider({ purchaseLabel: vi.fn().mockResolvedValue(readyResult(orderId)) });
      const order = await Order.findById(orderId).lean();

      const result = await processOrderLabel(orderId, { provider });

      expect(result.outcome).toBe("ready");
      expect(provider.purchaseLabel).toHaveBeenCalledTimes(1);
      const [input, options] = vi.mocked(provider.purchaseLabel).mock.calls[0]!;
      expect(input).toMatchObject({
        orderId,
        orderNumber: order!.orderNumber,
        providerRateId: order!.providerShipping!.providerRateId,
        providerQuoteId: "stub-quote",
        idempotencyKey: `label-${orderId}`,
      });
      expect(input.origin).toMatchObject({ postalCode: SHIPPING_ORIGIN.postalCode });
      expect(input.destination).toMatchObject({ postalCode: order!.shippingAddress.postalCode });
      expect(input.parcel).toMatchObject({ weightGrams: order!.parcel.weightGrams });
      expect(options.signal).toBeInstanceOf(AbortSignal);

      const after = await Order.findById(orderId).lean();
      expect(after!.label).toMatchObject({
        status: ShippingLabelStatus.READY,
        attempts: 1,
        providerShipmentId: `ship-${orderId}`,
        trackingNumber: `TRK-${orderId}`,
        carrier: ShippingCarrier.FEDEX,
        labelUrl: "https://labels.example/1.pdf",
      });
      expect(after!.label!.readyAt).toBeInstanceOf(Date);
      expect(after!.status).toBe(OrderStatus.PROCESSING);
      expect(after!.statusHistory.at(-1)!.actorType).toBe("system");
    });

    it("audita label_requested y label_created", async () => {
      const { orderId } = await seedPaidOrder();
      const provider = buildFakeShippingProvider({ purchaseLabel: vi.fn().mockResolvedValue(readyResult(orderId)) });

      await processOrderLabel(orderId, { provider });

      expect(await AuditLog.countDocuments({ action: "label_requested", targetId: orderId })).toBe(1);
      expect(await AuditLog.countDocuments({ action: "label_created", targetId: orderId })).toBe(1);
    });

    it("si el admin ya movió la orden a processing, la guía igual queda ready y no hay error", async () => {
      const { orderId } = await seedPaidOrder();
      await Order.updateOne({ _id: orderId }, { $set: { status: OrderStatus.PROCESSING } });
      const provider = buildFakeShippingProvider({ purchaseLabel: vi.fn().mockResolvedValue(readyResult(orderId)) });

      const result = await processOrderLabel(orderId, { provider });

      expect(result.outcome).toBe("ready");
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.status).toBe(ShippingLabelStatus.READY);
      expect(after!.status).toBe(OrderStatus.PROCESSING);
    });

    it("una guía ya ready no se vuelve a comprar", async () => {
      const { orderId } = await seedPaidOrder();
      const provider = buildFakeShippingProvider({ purchaseLabel: vi.fn().mockResolvedValue(readyResult(orderId)) });
      await processOrderLabel(orderId, { provider });

      const second = await processOrderLabel(orderId, { provider });

      expect(second.outcome).toBe("skipped_not_claimable");
      expect(provider.purchaseLabel).toHaveBeenCalledTimes(1);
    });
  });

  describe("proveedor la acepta pero aún no está lista (processing)", () => {
    it("guarda el providerShipmentId, la orden sigue paid y JAMÁS se vuelve a comprar", async () => {
      const { orderId } = await seedPaidOrder();
      const provider = buildFakeShippingProvider({
        purchaseLabel: vi.fn().mockResolvedValue({ status: "processing", providerShipmentId: "ship-async-1" }),
      });

      const first = await processOrderLabel(orderId, { provider });
      const second = await processOrderLabel(orderId, { provider });

      expect(first.outcome).toBe("processing");
      expect(second.outcome).toBe("skipped_not_claimable");
      expect(provider.purchaseLabel).toHaveBeenCalledTimes(1);
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.status).toBe(ShippingLabelStatus.PROCESSING);
      expect(after!.label!.providerShipmentId).toBe("ship-async-1");
      expect(after!.status).toBe(OrderStatus.PAID);
    });
  });

  describe("rechazos explícitos (seguros de reintentar)", () => {
    it.each(["rejected", "unavailable"] as const)(
      "un '%s' deja la guía failed con backoff exponencial y NO alerta todavía",
      async (kind) => {
        const { orderId } = await seedPaidOrder();
        const mail = buildFakeMailProvider();
        __setMailProviderForTests(mail);
        __setAdminAlertEmailForTests("ops@esenciaglow.mx");
        const provider = buildFakeShippingProvider({
          purchaseLabel: vi.fn().mockRejectedValue(new ShippingProviderError(kind, "Sin créditos suficientes")),
        });
        const now = new Date();

        const result = await processOrderLabel(orderId, { provider, now });

        expect(result.outcome).toBe("failed");
        const after = await Order.findById(orderId).lean();
        expect(after!.label!.status).toBe(ShippingLabelStatus.FAILED);
        expect(after!.label!.attempts).toBe(1);
        expect(after!.label!.lastError).toBe("Sin créditos suficientes");
        expect(after!.label!.nextAttemptAt!.getTime()).toBe(now.getTime() + LABEL_BACKOFF_BASE_MINUTES * MINUTE);
        expect(after!.status).toBe(OrderStatus.PAID);
        expect(mail.calls).toHaveLength(0);
        expect(await AuditLog.countDocuments({ action: "label_failed", targetId: orderId })).toBe(1);
      },
    );

    it("no reintenta antes de nextAttemptAt; al vencer el backoff reintenta y puede tener éxito", async () => {
      const { orderId } = await seedPaidOrder();
      const purchaseLabel = vi
        .fn()
        .mockRejectedValueOnce(new ShippingProviderError("rejected", "Falla temporal"))
        .mockResolvedValueOnce(readyResult(orderId));
      const provider = buildFakeShippingProvider({ purchaseLabel });
      const t0 = new Date();
      await processOrderLabel(orderId, { provider, now: t0 });

      const tooSoon = await processOrderLabel(orderId, { provider, now: new Date(t0.getTime() + MINUTE) });
      expect(tooSoon.outcome).toBe("skipped_not_claimable");
      expect(purchaseLabel).toHaveBeenCalledTimes(1);

      const retry = await processOrderLabel(orderId, { provider, now: new Date(t0.getTime() + 6 * MINUTE) });
      expect(retry.outcome).toBe("ready");
      expect(purchaseLabel).toHaveBeenCalledTimes(2);
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.attempts).toBe(2);
      expect(after!.label!.status).toBe(ShippingLabelStatus.READY);
    });

    it("el backoff se duplica en cada intento (5, 10, 20… minutos)", async () => {
      const { orderId } = await seedPaidOrder();
      const provider = buildFakeShippingProvider({
        purchaseLabel: vi.fn().mockRejectedValue(new ShippingProviderError("rejected", "x")),
      });
      const t0 = new Date();
      await processOrderLabel(orderId, { provider, now: t0 });
      const t1 = new Date(t0.getTime() + 6 * MINUTE);

      await processOrderLabel(orderId, { provider, now: t1 });

      const after = await Order.findById(orderId).lean();
      expect(after!.label!.attempts).toBe(2);
      expect(after!.label!.nextAttemptAt!.getTime()).toBe(t1.getTime() + 2 * LABEL_BACKOFF_BASE_MINUTES * MINUTE);
    });

    it("al agotar LABEL_MAX_ATTEMPTS pasa a needs_review y alerta UNA vez al admin", async () => {
      const { orderId } = await seedPaidOrder();
      const mail = buildFakeMailProvider();
      __setMailProviderForTests(mail);
      __setAdminAlertEmailForTests("ops@esenciaglow.mx");
      const provider = buildFakeShippingProvider({
        purchaseLabel: vi.fn().mockRejectedValue(new ShippingProviderError("rejected", "Dirección inválida")),
      });
      await Order.updateOne(
        { _id: orderId },
        { $set: { "label.status": ShippingLabelStatus.FAILED, "label.attempts": LABEL_MAX_ATTEMPTS - 1, "label.nextAttemptAt": new Date(0) } },
      );

      const result = await processOrderLabel(orderId, { provider });

      expect(result.outcome).toBe("needs_review");
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.status).toBe(ShippingLabelStatus.NEEDS_REVIEW);
      expect(after!.label!.attempts).toBe(LABEL_MAX_ATTEMPTS);
      expect(after!.label!.adminAlertedAt).toBeInstanceOf(Date);
      expect(mail.calls).toHaveLength(1);
      expect(mail.calls[0]!.html).toContain("Dirección inválida");
      expect(await AuditLog.countDocuments({ action: "label_needs_review", targetId: orderId })).toBe(1);
    });
  });

  describe("resultado desconocido: NUNCA se recompra sola", () => {
    it("un unknown_outcome manda la guía a needs_review de inmediato, alerta, y no se vuelve a comprar", async () => {
      const { orderId } = await seedPaidOrder();
      const mail = buildFakeMailProvider();
      __setMailProviderForTests(mail);
      __setAdminAlertEmailForTests("ops@esenciaglow.mx");
      const provider = buildFakeShippingProvider({
        purchaseLabel: vi.fn().mockRejectedValue(new ShippingProviderError("unknown_outcome", "Timeout a media compra")),
      });

      const first = await processOrderLabel(orderId, { provider });
      const later = await processOrderLabel(orderId, { provider, now: new Date(Date.now() + 24 * 60 * MINUTE) });

      expect(first.outcome).toBe("needs_review");
      expect(later.outcome).toBe("skipped_not_claimable");
      expect(provider.purchaseLabel).toHaveBeenCalledTimes(1);
      expect(mail.calls).toHaveLength(1);
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.status).toBe(ShippingLabelStatus.NEEDS_REVIEW);
      expect(after!.label!.lastError).toBe("Timeout a media compra");
    });

    it("una excepción inesperada del adapter durante la compra se trata como unknown_outcome", async () => {
      const { orderId } = await seedPaidOrder();
      const provider = buildFakeShippingProvider({ purchaseLabel: vi.fn().mockRejectedValue(new TypeError("boom")) });

      const result = await processOrderLabel(orderId, { provider });

      expect(result.outcome).toBe("needs_review");
    });

    it("un proveedor que se cuelga (ignora la señal) se corta por deadline y va a needs_review", async () => {
      const { orderId } = await seedPaidOrder();
      const provider = buildFakeShippingProvider({ purchaseLabel: () => new Promise(() => {}) });

      const result = await processOrderLabel(orderId, { provider, timeoutMs: 30 });

      expect(result.outcome).toBe("needs_review");
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.status).toBe(ShippingLabelStatus.NEEDS_REVIEW);
    });
  });

  describe("errores DESPUÉS del claim pero ANTES de comprar (nada se cobró)", () => {
    it("si leer la configuración falla, la guía NO se queda requested: vuelve a failed con backoff y sin alertar 'resultado desconocido'", async () => {
      const { orderId } = await seedPaidOrder();
      const provider = buildFakeShippingProvider();
      const spy = vi.spyOn(Settings, "findById").mockImplementationOnce((() => ({
        lean: () => Promise.reject(new Error("blip de base de datos")),
      })) as never);

      const result = await processOrderLabel(orderId, { provider });
      spy.mockRestore();

      expect(result.outcome).toBe("failed");
      expect(provider.purchaseLabel).not.toHaveBeenCalled();
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.status).toBe(ShippingLabelStatus.FAILED);
      expect(after!.label!.nextAttemptAt).toBeInstanceOf(Date);
    });
  });

  describe("error al GUARDAR el resultado de una compra que sí ocurrió", () => {
    it("registra en el log el providerShipmentId y el tracking para poder recuperarlos a mano", async () => {
      const { orderId } = await seedPaidOrder();
      const provider = buildFakeShippingProvider({ purchaseLabel: vi.fn().mockResolvedValue(readyResult(orderId)) });
      const original = Order.findOneAndUpdate.bind(Order);
      const spy = vi.spyOn(Order, "findOneAndUpdate").mockImplementation(((filter: Record<string, unknown>, ...rest: unknown[]) => {
        if ("label.requestedAt" in filter) return { lean: () => Promise.reject(new Error("blip al guardar")), then: undefined };
        return (original as (...args: unknown[]) => unknown)(filter, ...rest);
      }) as never);
      const errorLog = vi.spyOn(logger, "error");

      await processOrderLabel(orderId, { provider });
      spy.mockRestore();

      const logged = JSON.stringify(errorLog.mock.calls);
      errorLog.mockRestore();
      expect(logged).toContain(`ship-${orderId}`);
      expect(logged).toContain(`TRK-${orderId}`);
    });
  });

  describe("deadline con un adapter que respeta la señal", () => {
    it("si al vencer el deadline el adapter rechaza con 'unavailable', igual es needs_review (pudo haber cobrado), no failed", async () => {
      const { orderId } = await seedPaidOrder();
      const provider = buildFakeShippingProvider({
        purchaseLabel: (_input, { signal }) =>
          new Promise((_resolve, reject) => {
            signal!.addEventListener("abort", () => reject(new ShippingProviderError("unavailable", "abortado")));
          }),
      });

      const result = await processOrderLabel(orderId, { provider, timeoutMs: 30 });

      expect(result.outcome).toBe("needs_review");
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.status).toBe(ShippingLabelStatus.NEEDS_REVIEW);
    });
  });

  describe("concurrencia y fencing", () => {
    it("seis ejecuciones concurrentes sobre la misma orden compran EXACTAMENTE una guía", async () => {
      const { orderId } = await seedPaidOrder();
      const purchaseLabel = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 25));
        return readyResult(orderId);
      });
      const provider = buildFakeShippingProvider({ purchaseLabel });

      const results = await Promise.all(Array.from({ length: 6 }, () => processOrderLabel(orderId, { provider })));

      expect(purchaseLabel).toHaveBeenCalledTimes(1);
      expect(results.filter((r) => r.outcome === "ready")).toHaveLength(1);
      expect(results.filter((r) => r.outcome === "skipped_not_claimable")).toHaveLength(5);
    });

    it("una respuesta tardía de un intento viejo NO pisa un claim más nuevo (fencing)", async () => {
      const { orderId } = await seedPaidOrder();
      const slow = deferred<ShippingLabelResult>();
      const provider = buildFakeShippingProvider({ purchaseLabel: vi.fn().mockReturnValue(slow.promise) });

      const inFlight = processOrderLabel(orderId, { provider });
      await waitForLabelStatus(orderId, ShippingLabelStatus.REQUESTED);
      // Otro escritor reclamó la guía de nuevo (intento 2) mientras el 1 seguía en vuelo.
      await Order.updateOne(
        { _id: orderId },
        { $set: { "label.attempts": 2, "label.requestedAt": new Date(Date.now() + 5_000), "label.status": ShippingLabelStatus.REQUESTED } },
      );
      slow.resolve(readyResult(orderId));
      const result = await inFlight;

      expect(result.outcome).toBe("stale");
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.status).toBe(ShippingLabelStatus.REQUESTED);
      expect(after!.label!.attempts).toBe(2);
      expect(after!.label!.trackingNumber).toBeUndefined();
    });

    it("fencing con attempts IGUAL: tras un reintento del admin (attempts reiniciado) solo requestedAt distingue al intento viejo", async () => {
      const { orderId } = await seedPaidOrder();
      const slow = deferred<ShippingLabelResult>();
      const provider = buildFakeShippingProvider({ purchaseLabel: vi.fn().mockReturnValue(slow.promise) });

      const inFlight = processOrderLabel(orderId, { provider });
      await waitForLabelStatus(orderId, ShippingLabelStatus.REQUESTED);
      // El admin reintentó (attempts vuelve a 0) y un claim NUEVO llegó otra vez a attempts=1.
      await Order.updateOne(
        { _id: orderId },
        { $set: { "label.attempts": 1, "label.requestedAt": new Date(Date.now() + 5_000), "label.status": ShippingLabelStatus.REQUESTED } },
      );
      slow.resolve(readyResult(orderId));
      const result = await inFlight;

      expect(result.outcome).toBe("stale");
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.status).toBe(ShippingLabelStatus.REQUESTED);
      expect(after!.label!.trackingNumber).toBeUndefined();
    });

    it("un ÉXITO tardío cuyo lease ya se mandó a needs_review SÍ se registra (el dinero ya se gastó)", async () => {
      const { orderId } = await seedPaidOrder();
      const slow = deferred<ShippingLabelResult>();
      const provider = buildFakeShippingProvider({ purchaseLabel: vi.fn().mockReturnValue(slow.promise) });

      const inFlight = processOrderLabel(orderId, { provider });
      await waitForLabelStatus(orderId, ShippingLabelStatus.REQUESTED);
      // El barrido de leases vencidos la mandó a revisión (mismo requestedAt/attempts).
      await Order.updateOne({ _id: orderId }, { $set: { "label.status": ShippingLabelStatus.NEEDS_REVIEW } });
      slow.resolve(readyResult(orderId));
      const result = await inFlight;

      expect(result.outcome).toBe("ready");
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.status).toBe(ShippingLabelStatus.READY);
      expect(after!.label!.trackingNumber).toBe(`TRK-${orderId}`);
    });
  });

  describe("elegibilidad: cuándo NO se compra", () => {
    it.each([OrderStatus.PENDING, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED])(
      "una orden en '%s' nunca compra guía",
      async (status) => {
        const { orderId } = await seedPaidOrder();
        await Order.updateOne({ _id: orderId }, { $set: { status } });
        const provider = buildFakeShippingProvider();

        const result = await processOrderLabel(orderId, { provider });

        expect(result.outcome).toBe("skipped_not_claimable");
        expect(provider.purchaseLabel).not.toHaveBeenCalled();
      },
    );

    it("una orden sin label (p. ej. inventory_incident o anterior a 1.9) nunca compra", async () => {
      const { orderId } = await seedPaidOrder();
      await Order.updateOne({ _id: orderId }, { $unset: { label: "" } });
      const provider = buildFakeShippingProvider();

      const result = await processOrderLabel(orderId, { provider });

      expect(result.outcome).toBe("skipped_not_claimable");
      expect(provider.purchaseLabel).not.toHaveBeenCalled();
    });

    it("con contracargo abierto no se gastan créditos; al cerrarse, sí se compra", async () => {
      const { orderId } = await seedPaidOrder();
      await Order.updateOne({ _id: orderId }, { $set: { disputeStatus: DisputeStatus.OPEN } });
      const provider = buildFakeShippingProvider({ purchaseLabel: vi.fn().mockResolvedValue(readyResult(orderId)) });

      const blocked = await processOrderLabel(orderId, { provider });
      expect(blocked.outcome).toBe("skipped_not_claimable");
      expect(provider.purchaseLabel).not.toHaveBeenCalled();

      await Order.updateOne({ _id: orderId }, { $set: { disputeStatus: DisputeStatus.WON } });
      const allowed = await processOrderLabel(orderId, { provider });
      expect(allowed.outcome).toBe("ready");
    });

    it("una orden inexistente no revienta: skipped_not_claimable", async () => {
      const provider = buildFakeShippingProvider();
      const result = await processOrderLabel("64b7f0c2a1b2c3d4e5f60718", { provider });
      expect(result.outcome).toBe("skipped_not_claimable");
    });
  });

  describe("configuración y proveedor", () => {
    it("sin proveedor configurado (503) NO consume el intento: la guía sigue pending con 0 intentos", async () => {
      const { orderId } = await seedPaidOrder();
      __setShippingProviderForTests(undefined);

      const result = await processOrderLabel(orderId);

      expect(result.outcome).toBe("skipped_no_provider");
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.status).toBe(ShippingLabelStatus.PENDING);
      expect(after!.label!.attempts).toBe(0);
    });

    it("usa el proveedor resuelto (seam) cuando no se le pasa uno explícito", async () => {
      const { orderId } = await seedPaidOrder();
      const provider = buildFakeShippingProvider({ purchaseLabel: vi.fn().mockResolvedValue(readyResult(orderId)) });
      __setShippingProviderForTests(provider);

      const result = await processOrderLabel(orderId);

      expect(result.outcome).toBe("ready");
      expect(provider.purchaseLabel).toHaveBeenCalledTimes(1);
    });

    it("sin dirección de origen en Settings: needs_review inmediato con motivo claro, alerta, sin llamar al proveedor", async () => {
      const { orderId } = await seedPaidOrder();
      const mail = buildFakeMailProvider();
      __setMailProviderForTests(mail);
      __setAdminAlertEmailForTests("ops@esenciaglow.mx");
      const { Settings } = await import("../../src/models/settings.model.js");
      await Settings.updateOne({ _id: "global" }, { $unset: { "shipping.origin": "" } });
      const provider = buildFakeShippingProvider();

      const result = await processOrderLabel(orderId, { provider });

      expect(result.outcome).toBe("needs_review");
      expect(provider.purchaseLabel).not.toHaveBeenCalled();
      const after = await Order.findById(orderId).lean();
      expect(after!.label!.lastError).toBe("Falta la dirección de origen en la configuración de envíos.");
      expect(mail.calls).toHaveLength(1);
    });

    it("una tarifa de OTRO proveedor (stub vs skydropx) nunca se manda a comprar: needs_review", async () => {
      const { orderId } = await seedPaidOrder(); // cotizada con el stub
      const provider = buildFakeShippingProvider({ name: "skydropx" });

      const result = await processOrderLabel(orderId, { provider });

      expect(result.outcome).toBe("needs_review");
      expect(provider.purchaseLabel).not.toHaveBeenCalled();
    });

    it("una orden sin providerShipping (sin la tarifa del proveedor) va a needs_review", async () => {
      const { orderId } = await seedPaidOrder();
      await Order.updateOne({ _id: orderId }, { $unset: { providerShipping: "" } });
      const provider = buildFakeShippingProvider();

      const result = await processOrderLabel(orderId, { provider });

      expect(result.outcome).toBe("needs_review");
      expect(provider.purchaseLabel).not.toHaveBeenCalled();
    });
  });
});
