import {
  DisputeStatus,
  LABEL_PROCESSING_MAX_HOURS,
  LABEL_REQUEST_LEASE_MINUTES,
  OrderStatus,
  ShippingCarrier,
  ShippingLabelStatus,
} from "@esencia-glow/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processShippingLabels } from "../../src/jobs/process-shipping-labels.js";
import { Order } from "../../src/models/order.model.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { ShippingProviderError, __setShippingProviderForTests } from "../../src/services/shipping-provider.js";
import { __setAdminAlertEmailForTests } from "../../src/services/subscription-email.service.js";
import { resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";
import { buildFakeMailProvider } from "../helpers/fake-mail-provider.js";
import { buildFakeShippingProvider } from "../helpers/fake-shipping-provider.js";
import { seedPaidOrder, seedShippingOrigin } from "../helpers/paid-order-fixtures.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * `processShippingLabels` — el respaldo del disparo inmediato (1.9): retoma
 * guías pendientes/fallidas cuyo reintento ya venció, consulta las que el
 * proveedor aceptó pero no terminó (`processing`) y manda a revisión las que
 * quedaron a medias. NUNCA recompra una guía cuyo resultado se desconoce.
 */
describe("jobs/processShippingLabels", () => {
  beforeEach(async () => {
    resetCheckoutFixtureCounter();
    await seedShippingOrigin();
  });

  const readyFor = (orderId: string) => ({
    status: "ready" as const,
    providerShipmentId: `ship-${orderId}`,
    trackingNumber: `TRK-${orderId}`,
    carrier: ShippingCarrier.DHL,
    labelUrl: "https://labels.example/x.pdf",
  });

  async function seedProcessingLabel(requestedAt: Date) {
    const seeded = await seedPaidOrder();
    await Order.updateOne(
      { _id: seeded.orderId },
      {
        $set: {
          "label.status": ShippingLabelStatus.PROCESSING,
          "label.attempts": 1,
          "label.requestedAt": requestedAt,
          "label.providerShipmentId": `ship-${seeded.orderId}`,
        },
        $unset: { "label.nextAttemptAt": "" },
      },
    );
    return seeded;
  }

  describe("barrido 1: guías pendientes o fallidas con reintento vencido", () => {
    it("compra las guías pendientes de todas las órdenes pagadas", async () => {
      const a = await seedPaidOrder();
      const b = await seedPaidOrder();
      const provider = buildFakeShippingProvider();

      const summary = await processShippingLabels(new Date(), 100, provider);

      expect(summary.dispatched).toBe(2);
      expect(provider.purchaseLabel).toHaveBeenCalledTimes(2);
      for (const { orderId } of [a, b]) {
        const order = await Order.findById(orderId).lean();
        expect(order!.label!.status).toBe(ShippingLabelStatus.READY);
        expect(order!.status).toBe(OrderStatus.PROCESSING);
      }
    });

    it("no toca una guía failed cuyo nextAttemptAt todavía no vence", async () => {
      const { orderId } = await seedPaidOrder();
      const now = new Date();
      await Order.updateOne(
        { _id: orderId },
        { $set: { "label.status": ShippingLabelStatus.FAILED, "label.attempts": 1, "label.nextAttemptAt": new Date(now.getTime() + 5 * MINUTE) } },
      );
      const provider = buildFakeShippingProvider();

      const summary = await processShippingLabels(now, 100, provider);

      expect(summary.dispatched).toBe(0);
      expect(provider.purchaseLabel).not.toHaveBeenCalled();
    });

    it("respeta batchSize", async () => {
      await seedPaidOrder();
      await seedPaidOrder();
      const provider = buildFakeShippingProvider();

      const summary = await processShippingLabels(new Date(), 1, provider);

      expect(summary.dispatched).toBe(1);
      expect(provider.purchaseLabel).toHaveBeenCalledTimes(1);
    });

    it("una orden con contracargo abierto (más antigua) no acapara el lote: la siguiente sí se procesa", async () => {
      const disputed = await seedPaidOrder(); // su nextAttemptAt es MÁS antiguo
      const normal = await seedPaidOrder();
      await Order.updateOne({ _id: disputed.orderId }, { $set: { disputeStatus: DisputeStatus.OPEN } });
      const provider = buildFakeShippingProvider();

      const summary = await processShippingLabels(new Date(), 1, provider);

      expect(summary.dispatched).toBe(1);
      expect((await Order.findById(normal.orderId).lean())!.label!.status).toBe(ShippingLabelStatus.READY);
      expect((await Order.findById(disputed.orderId).lean())!.label!.status).toBe(ShippingLabelStatus.PENDING);
    });

    it("no compra para órdenes ya enviadas o canceladas aunque tengan una guía pendiente", async () => {
      const shipped = await seedPaidOrder();
      const cancelled = await seedPaidOrder();
      await Order.updateOne({ _id: shipped.orderId }, { $set: { status: OrderStatus.SHIPPED } });
      await Order.updateOne({ _id: cancelled.orderId }, { $set: { status: OrderStatus.CANCELLED } });
      const provider = buildFakeShippingProvider();

      const summary = await processShippingLabels(new Date(), 100, provider);

      expect(summary.dispatched).toBe(0);
      expect(provider.purchaseLabel).not.toHaveBeenCalled();
    });

    it("sin proveedor configurado no compra nada ni consume intentos", async () => {
      const { orderId } = await seedPaidOrder();
      __setShippingProviderForTests(undefined);

      const summary = await processShippingLabels(new Date(), 100);

      expect(summary).toMatchObject({ dispatched: 0, refreshed: 0 });
      const order = await Order.findById(orderId).lean();
      expect(order!.label!.status).toBe(ShippingLabelStatus.PENDING);
      expect(order!.label!.attempts).toBe(0);
    });
  });

  describe("barrido 2: guías processing (el proveedor ya cobró)", () => {
    it("consulta getLabel y, si ya está lista, la deja ready y mueve la orden a processing", async () => {
      const { orderId } = await seedProcessingLabel(new Date());
      const provider = buildFakeShippingProvider({ getLabel: vi.fn().mockResolvedValue(readyFor(orderId)) });

      const summary = await processShippingLabels(new Date(), 100, provider);

      expect(summary.refreshed).toBe(1);
      expect(provider.getLabel).toHaveBeenCalledWith(`ship-${orderId}`, expect.objectContaining({ signal: expect.any(AbortSignal) }));
      expect(provider.purchaseLabel).not.toHaveBeenCalled();
      const order = await Order.findById(orderId).lean();
      expect(order!.label!.status).toBe(ShippingLabelStatus.READY);
      expect(order!.label!.trackingNumber).toBe(`TRK-${orderId}`);
      expect(order!.status).toBe(OrderStatus.PROCESSING);
    });

    it("si sigue processing la deja como está, sin recomprar", async () => {
      const { orderId } = await seedProcessingLabel(new Date());
      const provider = buildFakeShippingProvider({
        getLabel: vi.fn().mockResolvedValue({ status: "processing", providerShipmentId: `ship-${orderId}` }),
      });

      const summary = await processShippingLabels(new Date(), 100, provider);

      expect(summary.refreshed).toBe(0);
      expect(provider.purchaseLabel).not.toHaveBeenCalled();
      expect((await Order.findById(orderId).lean())!.label!.status).toBe(ShippingLabelStatus.PROCESSING);
    });

    it("un error de getLabel en una orden no frena a las demás ni cambia su estado", async () => {
      const bad = await seedProcessingLabel(new Date());
      const good = await seedProcessingLabel(new Date());
      const provider = buildFakeShippingProvider({
        getLabel: vi.fn().mockImplementation(async (shipmentId: string) => {
          if (shipmentId === `ship-${bad.orderId}`) throw new ShippingProviderError("unavailable", "caído");
          return readyFor(good.orderId);
        }),
      });

      const summary = await processShippingLabels(new Date(), 100, provider);

      expect(summary.refreshed).toBe(1);
      expect((await Order.findById(bad.orderId).lean())!.label!.status).toBe(ShippingLabelStatus.PROCESSING);
      expect((await Order.findById(good.orderId).lean())!.label!.status).toBe(ShippingLabelStatus.READY);
    });

    it("una guía processing que no termina en LABEL_PROCESSING_MAX_HOURS va a needs_review y alerta", async () => {
      const mail = buildFakeMailProvider();
      __setMailProviderForTests(mail);
      __setAdminAlertEmailForTests("ops@esenciaglow.mx");
      const now = new Date();
      const { orderId } = await seedProcessingLabel(new Date(now.getTime() - (LABEL_PROCESSING_MAX_HOURS + 1) * HOUR));
      const provider = buildFakeShippingProvider({
        getLabel: vi.fn().mockResolvedValue({ status: "processing", providerShipmentId: `ship-${orderId}` }),
      });

      const summary = await processShippingLabels(now, 100, provider);

      expect(summary.reviewed).toBe(1);
      const order = await Order.findById(orderId).lean();
      expect(order!.label!.status).toBe(ShippingLabelStatus.NEEDS_REVIEW);
      expect(mail.calls).toHaveLength(1);
    });
  });

  describe("barrido 4: transiciones de orden que quedaron a medias", () => {
    async function seedReadyLabelOnPaidOrder() {
      const seeded = await seedPaidOrder();
      await Order.updateOne(
        { _id: seeded.orderId },
        {
          $set: {
            "label.status": ShippingLabelStatus.READY,
            "label.attempts": 1,
            "label.trackingNumber": "TRK-1",
            "label.carrier": ShippingCarrier.FEDEX,
            "label.readyAt": new Date(),
          },
        },
      );
      return seeded;
    }

    it("una guía ready sobre una orden todavía paid (la transición falló) la mueve a processing", async () => {
      const { orderId } = await seedReadyLabelOnPaidOrder();

      const summary = await processShippingLabels(new Date(), 100, buildFakeShippingProvider());

      expect(summary.reconciled).toBe(1);
      expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.PROCESSING);
    });

    it("con contracargo abierto no la mueve; al cerrarse la disputa, el siguiente barrido sí", async () => {
      const { orderId } = await seedReadyLabelOnPaidOrder();
      await Order.updateOne({ _id: orderId }, { $set: { disputeStatus: DisputeStatus.OPEN } });

      const blocked = await processShippingLabels(new Date(), 100, buildFakeShippingProvider());
      expect(blocked.reconciled).toBe(0);
      expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.PAID);

      await Order.updateOne({ _id: orderId }, { $set: { disputeStatus: DisputeStatus.WON } });
      const allowed = await processShippingLabels(new Date(), 100, buildFakeShippingProvider());
      expect(allowed.reconciled).toBe(1);
      expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.PROCESSING);
    });

    it("un rastreo delivered sobre una orden que se quedó en shipped (entrega bloqueada por disputa) la cierra al resolverse", async () => {
      const { orderId } = await seedReadyLabelOnPaidOrder();
      await Order.updateOne(
        { _id: orderId },
        {
          $set: {
            status: OrderStatus.SHIPPED,
            shipment: { carrier: ShippingCarrier.FEDEX, trackingNumber: "TRK-1", shippedAt: new Date() },
            tracking: { status: "delivered", lastEventAt: new Date() },
          },
        },
      );

      const summary = await processShippingLabels(new Date(), 100, buildFakeShippingProvider());

      expect(summary.reconciled).toBe(1);
      expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.DELIVERED);
    });

    it("no toca órdenes ya consistentes ni canceladas/reembolsadas", async () => {
      const ok = await seedReadyLabelOnPaidOrder();
      await Order.updateOne({ _id: ok.orderId }, { $set: { status: OrderStatus.PROCESSING } });
      const cancelled = await seedReadyLabelOnPaidOrder();
      await Order.updateOne({ _id: cancelled.orderId }, { $set: { status: OrderStatus.CANCELLED } });

      const summary = await processShippingLabels(new Date(), 100, buildFakeShippingProvider());

      expect(summary.reconciled).toBe(0);
      expect((await Order.findById(cancelled.orderId).lean())!.status).toBe(OrderStatus.CANCELLED);
    });

    it("corre aunque no haya proveedor configurado (no lo necesita)", async () => {
      const { orderId } = await seedReadyLabelOnPaidOrder();
      __setShippingProviderForTests(undefined);

      const summary = await processShippingLabels(new Date(), 100);

      expect(summary.reconciled).toBe(1);
      expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.PROCESSING);
    });
  });

  describe("barrido 3: claims muertos (el proceso murió a media compra)", () => {
    async function seedRequestedLabel(requestedAt: Date) {
      const seeded = await seedPaidOrder();
      await Order.updateOne(
        { _id: seeded.orderId },
        { $set: { "label.status": ShippingLabelStatus.REQUESTED, "label.attempts": 1, "label.requestedAt": requestedAt } },
      );
      return seeded;
    }

    it("un requested con el lease vencido va a needs_review, alerta, y NO se recompra", async () => {
      const mail = buildFakeMailProvider();
      __setMailProviderForTests(mail);
      __setAdminAlertEmailForTests("ops@esenciaglow.mx");
      const now = new Date();
      const { orderId } = await seedRequestedLabel(new Date(now.getTime() - (LABEL_REQUEST_LEASE_MINUTES + 1) * MINUTE));
      const provider = buildFakeShippingProvider();

      const summary = await processShippingLabels(now, 100, provider);

      expect(summary.reviewed).toBe(1);
      expect(provider.purchaseLabel).not.toHaveBeenCalled();
      const order = await Order.findById(orderId).lean();
      expect(order!.label!.status).toBe(ShippingLabelStatus.NEEDS_REVIEW);
      expect(order!.label!.lastError).toContain("no se sabe si el proveedor cobró");
      expect(mail.calls).toHaveLength(1);
    });

    it("un requested DENTRO del lease no se toca (hay una compra en vuelo)", async () => {
      const now = new Date();
      const { orderId } = await seedRequestedLabel(new Date(now.getTime() - MINUTE));
      const provider = buildFakeShippingProvider();

      const summary = await processShippingLabels(now, 100, provider);

      expect(summary.reviewed).toBe(0);
      expect((await Order.findById(orderId).lean())!.label!.status).toBe(ShippingLabelStatus.REQUESTED);
    });

    it("corre aunque no haya proveedor configurado (no necesita llamarlo)", async () => {
      const now = new Date();
      const { orderId } = await seedRequestedLabel(new Date(now.getTime() - (LABEL_REQUEST_LEASE_MINUTES + 1) * MINUTE));
      __setShippingProviderForTests(undefined);

      const summary = await processShippingLabels(now, 100);

      expect(summary.reviewed).toBe(1);
      expect((await Order.findById(orderId).lean())!.label!.status).toBe(ShippingLabelStatus.NEEDS_REVIEW);
    });
  });
});
