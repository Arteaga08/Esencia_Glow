import {
  DisputeStatus,
  OrderStatus,
  ShipmentTrackingStatus as S,
  ShippingCarrier,
  ShippingLabelStatus,
} from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Order } from "../../src/models/order.model.js";
import { ShipmentTrackingEvent } from "../../src/models/shipment-tracking-event.model.js";
import { recordTrackingEvent, type RecordTrackingEventInput } from "../../src/services/shipment-tracking.service.js";
import { resetCheckoutFixtureCounter } from "../helpers/checkout-fixtures.js";
import { seedPaidOrder } from "../helpers/paid-order-fixtures.js";

const MINUTE = 60_000;
const T0 = new Date("2026-09-21T10:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * MINUTE);

let eventCounter = 0;
function event(orderId: string, status: S, occurredAt: Date, overrides: Partial<RecordTrackingEventInput> = {}): RecordTrackingEventInput {
  eventCounter += 1;
  return { orderId, provider: "stub", providerEventId: `evt-${eventCounter}`, status, occurredAt, ...overrides };
}

/**
 * `recordTrackingEvent` — sub-recurso de rastreo (1.9). Los proveedores de
 * paquetería entregan eventos duplicados y fuera de orden: el log guarda TODO
 * (dedupe por evento), pero el estado solo AVANZA, y de él cuelgan las
 * transiciones automáticas de la orden.
 */
describe("services/shipment-tracking — recordTrackingEvent", () => {
  beforeEach(() => {
    resetCheckoutFixtureCounter();
    eventCounter = 0;
  });

  /** Orden con la guía lista y ya en `processing` (lo normal tras comprar la guía). */
  async function seedShippableOrder() {
    const seeded = await seedPaidOrder();
    await Order.updateOne(
      { _id: seeded.orderId },
      {
        $set: {
          status: OrderStatus.PROCESSING,
          label: {
            status: ShippingLabelStatus.READY,
            attempts: 1,
            providerShipmentId: "ship-1",
            trackingNumber: "TRK-1",
            carrier: ShippingCarrier.FEDEX,
            labelUrl: "https://labels.example/1.pdf",
            trackingUrl: "https://track.example/1",
          },
        },
      },
    );
    return seeded;
  }

  describe("log de eventos y estado", () => {
    it("guarda el evento y fija tracking.status / lastEventAt", async () => {
      const { orderId } = await seedShippableOrder();

      const result = await recordTrackingEvent(
        event(orderId, S.IN_TRANSIT, at(0), { description: "En tránsito", location: "Guadalajara, JAL" }),
      );

      expect(result.outcome).toBe("recorded");
      expect(result.trackingChanged).toBe(true);
      const order = await Order.findById(orderId).lean();
      expect(order!.tracking).toMatchObject({ status: S.IN_TRANSIT });
      expect(order!.tracking!.lastEventAt.getTime()).toBe(at(0).getTime());
      const stored = await ShipmentTrackingEvent.find({ orderId }).lean();
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ status: S.IN_TRANSIT, description: "En tránsito", location: "Guadalajara, JAL" });
    });

    it("un evento duplicado (mismo proveedor + providerEventId) es un no-op: un solo registro y un solo audit", async () => {
      const { orderId } = await seedShippableOrder();
      const input = event(orderId, S.IN_TRANSIT, at(0));

      const first = await recordTrackingEvent(input);
      const second = await recordTrackingEvent(input);

      expect(first.outcome).toBe("recorded");
      expect(second.outcome).toBe("duplicate");
      expect(second.trackingChanged).toBe(false);
      expect(await ShipmentTrackingEvent.countDocuments({ orderId })).toBe(1);
      expect(await AuditLog.countDocuments({ action: "tracking_updated", targetId: orderId })).toBe(1);
    });

    it("el mismo providerEventId de OTRO proveedor no es duplicado", async () => {
      const { orderId } = await seedShippableOrder();
      await recordTrackingEvent(event(orderId, S.PICKED_UP, at(0), { provider: "stub", providerEventId: "same" }));

      const other = await recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(1), { provider: "skydropx", providerEventId: "same" }));

      expect(other.outcome).toBe("recorded");
      expect(await ShipmentTrackingEvent.countDocuments({ orderId })).toBe(2);
    });

    it("una orden inexistente => order_not_found y no guarda nada", async () => {
      const result = await recordTrackingEvent(event("64b7f0c2a1b2c3d4e5f60718", S.IN_TRANSIT, at(0)));
      expect(result.outcome).toBe("order_not_found");
      expect(await ShipmentTrackingEvent.countDocuments()).toBe(0);
    });

    it("un evento fuera de orden (más viejo) se GUARDA en el log pero no hace retroceder el estado", async () => {
      const { orderId } = await seedShippableOrder();
      await recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(10)));

      const late = await recordTrackingEvent(event(orderId, S.PICKED_UP, at(0)));

      expect(late.outcome).toBe("recorded");
      expect(late.trackingChanged).toBe(false);
      const order = await Order.findById(orderId).lean();
      expect(order!.tracking!.status).toBe(S.IN_TRANSIT);
      expect(await ShipmentTrackingEvent.countDocuments({ orderId })).toBe(2);
      expect(await AuditLog.countDocuments({ action: "tracking_updated", targetId: orderId })).toBe(1);
    });

    it("tras delivered, un evento tardío de tránsito NO lo hace retroceder", async () => {
      const { orderId } = await seedShippableOrder();
      await recordTrackingEvent(event(orderId, S.DELIVERED, at(20)));

      await recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(30)));

      const order = await Order.findById(orderId).lean();
      expect(order!.tracking!.status).toBe(S.DELIVERED);
      expect(order!.status).toBe(OrderStatus.DELIVERED);
    });

    it("una exception más nueva se registra; una más vieja que el último evento no", async () => {
      const { orderId } = await seedShippableOrder();
      await recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(10)));

      const older = await recordTrackingEvent(event(orderId, S.EXCEPTION, at(5)));
      expect(older.trackingChanged).toBe(false);
      const newer = await recordTrackingEvent(event(orderId, S.EXCEPTION, at(15)));
      expect(newer.trackingChanged).toBe(true);
      expect((await Order.findById(orderId).lean())!.tracking!.status).toBe(S.EXCEPTION);
    });

    it("tras una exception, un avance más nuevo la supera; el estado de la orden no se toca por la exception", async () => {
      const { orderId } = await seedShippableOrder();
      await recordTrackingEvent(event(orderId, S.EXCEPTION, at(5)));
      expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.PROCESSING);

      await recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(10)));

      const order = await Order.findById(orderId).lean();
      expect(order!.tracking!.status).toBe(S.IN_TRANSIT);
      expect(order!.status).toBe(OrderStatus.SHIPPED);
    });

    it("returned es terminal y no mueve la orden", async () => {
      const { orderId } = await seedShippableOrder();
      await recordTrackingEvent(event(orderId, S.RETURNED, at(10)));
      await recordTrackingEvent(event(orderId, S.DELIVERED, at(20)));

      const order = await Order.findById(orderId).lean();
      expect(order!.tracking!.status).toBe(S.RETURNED);
      expect(order!.status).toBe(OrderStatus.PROCESSING);
    });
  });

  describe("efectos sobre el estado de la orden (actor system)", () => {
    it.each([S.PICKED_UP, S.IN_TRANSIT, S.OUT_FOR_DELIVERY])(
      "'%s' sobre una orden en processing la pasa a shipped y sella la guía desde la etiqueta",
      async (status) => {
        const { orderId } = await seedShippableOrder();

        const result = await recordTrackingEvent(event(orderId, status, at(0)));

        expect(result.orderEffect).toBe("applied");
        const order = await Order.findById(orderId).lean();
        expect(order!.status).toBe(OrderStatus.SHIPPED);
        expect(order!.shipment).toMatchObject({
          carrier: ShippingCarrier.FEDEX,
          trackingNumber: "TRK-1",
          trackingUrl: "https://track.example/1",
        });
        expect(order!.statusHistory.at(-1)!.actorType).toBe("system");
      },
    );

    it("label_created no mueve la orden", async () => {
      const { orderId } = await seedShippableOrder();
      const result = await recordTrackingEvent(event(orderId, S.LABEL_CREATED, at(0)));
      expect(result.orderEffect).toBe("none");
      expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.PROCESSING);
    });

    it("delivered sobre una orden shipped la pasa a delivered", async () => {
      const { orderId } = await seedShippableOrder();
      await recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(0)));

      await recordTrackingEvent(event(orderId, S.DELIVERED, at(10)));

      expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.DELIVERED);
    });

    it("delivered sobre una orden que seguía en processing avanza en DOS pasos (shipped y delivered) y deja ambos en la bitácora", async () => {
      const { orderId } = await seedShippableOrder();

      await recordTrackingEvent(event(orderId, S.DELIVERED, at(10)));

      const order = await Order.findById(orderId).lean();
      expect(order!.status).toBe(OrderStatus.DELIVERED);
      expect(order!.shipment!.trackingNumber).toBe("TRK-1");
      const statuses = order!.statusHistory.map((h) => h.status);
      expect(statuses.slice(-2)).toEqual([OrderStatus.SHIPPED, OrderStatus.DELIVERED]);
    });

    it("sobre una orden todavía en paid, un evento de tránsito avanza paid -> processing -> shipped", async () => {
      const { orderId } = await seedPaidOrder();
      await Order.updateOne(
        { _id: orderId },
        { $set: { "label.status": ShippingLabelStatus.READY, "label.trackingNumber": "TRK-9", "label.carrier": ShippingCarrier.DHL } },
      );

      await recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(0)));

      const order = await Order.findById(orderId).lean();
      expect(order!.status).toBe(OrderStatus.SHIPPED);
      expect(order!.shipment!.trackingNumber).toBe("TRK-9");
    });

    it("con contracargo abierto NO despacha: el rastreo se registra, la orden no se mueve y queda auditado", async () => {
      const { orderId } = await seedShippableOrder();
      await Order.updateOne({ _id: orderId }, { $set: { disputeStatus: DisputeStatus.OPEN } });

      const result = await recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(0)));

      expect(result.orderEffect).toBe("skipped_dispute");
      const order = await Order.findById(orderId).lean();
      expect(order!.tracking!.status).toBe(S.IN_TRANSIT);
      expect(order!.status).toBe(OrderStatus.PROCESSING);
      expect(await AuditLog.countDocuments({ action: "tracking_transition_skipped_dispute", targetId: orderId })).toBe(1);
    });

    it("con contracargo abierto, delivered sobre una orden ya shipped SÍ se aplica (el guard solo bloquea despachar)", async () => {
      const { orderId } = await seedShippableOrder();
      await recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(0)));
      await Order.updateOne({ _id: orderId }, { $set: { disputeStatus: DisputeStatus.OPEN } });

      await recordTrackingEvent(event(orderId, S.DELIVERED, at(10)));

      expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.DELIVERED);
    });

    it("sin guía lista no hay de dónde armar el envío: el rastreo se registra y la orden no se mueve (skipped_no_label)", async () => {
      const { orderId } = await seedPaidOrder();
      await Order.updateOne({ _id: orderId }, { $set: { status: OrderStatus.PROCESSING } }); // label sigue pending

      const result = await recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(0)));

      expect(result.orderEffect).toBe("skipped_no_label");
      const order = await Order.findById(orderId).lean();
      expect(order!.tracking!.status).toBe(S.IN_TRANSIT);
      expect(order!.status).toBe(OrderStatus.PROCESSING);
    });

    it.each([OrderStatus.CANCELLED, OrderStatus.REFUNDED])(
      "una orden '%s' registra el rastreo pero no cambia de estado (skipped_state)",
      async (status) => {
        const { orderId } = await seedShippableOrder();
        await Order.updateOne({ _id: orderId }, { $set: { status } });

        const result = await recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(0)));

        expect(result.orderEffect).toBe("skipped_state");
        expect((await Order.findById(orderId).lean())!.status).toBe(status);
      },
    );

    it("si el admin ya la marcó shipped a mano, el evento no la toca ni sobrescribe su guía", async () => {
      const { orderId } = await seedShippableOrder();
      await Order.updateOne(
        { _id: orderId },
        { $set: { status: OrderStatus.SHIPPED, shipment: { carrier: ShippingCarrier.REDPACK, trackingNumber: "MANUAL-1", shippedAt: new Date() } } },
      );

      await recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(0)));

      const order = await Order.findById(orderId).lean();
      expect(order!.status).toBe(OrderStatus.SHIPPED);
      expect(order!.shipment!.trackingNumber).toBe("MANUAL-1");
    });
  });

  describe("reentrega: completa un efecto que quedó a medias", () => {
    it("si el rastreo ya avanzó pero la orden no (el proceso murió a media transición), la reentrega del MISMO evento termina el trabajo", async () => {
      const { orderId } = await seedShippableOrder();
      const input = event(orderId, S.DELIVERED, at(20));
      // Estado que deja un primer intento muerto: evento guardado + tracking delivered, orden aún en processing.
      await ShipmentTrackingEvent.create({ ...input, orderId });
      await Order.updateOne({ _id: orderId }, { $set: { tracking: { status: S.DELIVERED, lastEventAt: at(20) } } });

      const result = await recordTrackingEvent(input);

      expect(result.outcome).toBe("duplicate");
      expect(result.orderEffect).toBe("applied");
      expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.DELIVERED);
    });

    it("un evento VIEJO que no mueve el rastreo también converge la orden hacia el rastreo actual (no hacia el viejo)", async () => {
      const { orderId } = await seedShippableOrder();
      await Order.updateOne({ _id: orderId }, { $set: { tracking: { status: S.IN_TRANSIT, lastEventAt: at(20) } } });

      await recordTrackingEvent(event(orderId, S.LABEL_CREATED, at(0)));

      const order = await Order.findById(orderId).lean();
      expect(order!.status).toBe(OrderStatus.SHIPPED); // convergió al in_transit vigente
      expect(order!.tracking!.status).toBe(S.IN_TRANSIT);
    });

    it("con rastreo en exception no hay nada que converger: la orden no se mueve", async () => {
      const { orderId } = await seedShippableOrder();
      await Order.updateOne({ _id: orderId }, { $set: { tracking: { status: S.EXCEPTION, lastEventAt: at(20) } } });

      const result = await recordTrackingEvent(event(orderId, S.LABEL_CREATED, at(0)));

      expect(result.orderEffect).toBe("none");
      expect((await Order.findById(orderId).lean())!.status).toBe(OrderStatus.PROCESSING);
    });
  });

  describe("concurrencia", () => {
    it("seis entregas simultáneas del MISMO evento: un solo registro y una sola transición", async () => {
      const { orderId } = await seedShippableOrder();
      const input = event(orderId, S.IN_TRANSIT, at(0));

      const results = await Promise.all(Array.from({ length: 6 }, () => recordTrackingEvent(input)));

      expect(results.filter((r) => r.outcome === "recorded")).toHaveLength(1);
      expect(results.filter((r) => r.outcome === "duplicate")).toHaveLength(5);
      const order = await Order.findById(orderId).lean();
      expect(order!.statusHistory.filter((h) => h.status === OrderStatus.SHIPPED)).toHaveLength(1);
    });

    it("in_transit y delivered simultáneos convergen: rastreo delivered y orden delivered, sin importar quién llegue primero", async () => {
      const { orderId } = await seedShippableOrder();

      await Promise.all([
        recordTrackingEvent(event(orderId, S.IN_TRANSIT, at(0))),
        recordTrackingEvent(event(orderId, S.DELIVERED, at(10))),
      ]);

      const order = await Order.findById(orderId).lean();
      expect(order!.tracking!.status).toBe(S.DELIVERED);
      expect(order!.status).toBe(OrderStatus.DELIVERED);
    });
  });
});
