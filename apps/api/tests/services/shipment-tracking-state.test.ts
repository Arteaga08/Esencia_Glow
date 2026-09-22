import { OrderStatus, ShipmentTrackingStatus as S } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import {
  TERMINAL_TRACKING_STATUSES,
  buildTrackingClaimFilter,
  canApplyTrackingEvent,
  orderTargetFor,
} from "../../src/services/shipment-tracking-state.js";

const T0 = new Date("2026-09-21T10:00:00Z");
const before = new Date(T0.getTime() - 60_000);
const after = new Date(T0.getTime() + 60_000);

const ALL = Object.values(S);

describe("services/shipment-tracking-state — canApplyTrackingEvent", () => {
  it("sin estado previo, cualquier evento aplica", () => {
    for (const status of ALL) {
      expect(canApplyTrackingEvent(undefined, { status, occurredAt: T0 })).toBe(true);
    }
  });

  it("solo avanza: un evento de menor o igual rango NO aplica, uno de mayor rango SÍ (sin importar la hora)", () => {
    const forward = [S.LABEL_CREATED, S.PICKED_UP, S.IN_TRANSIT, S.OUT_FOR_DELIVERY];
    for (let current = 0; current < forward.length; current += 1) {
      for (let next = 0; next < forward.length; next += 1) {
        const expected = next > current;
        expect(canApplyTrackingEvent({ status: forward[current]!, lastEventAt: T0 }, { status: forward[next]!, occurredAt: before })).toBe(expected);
        expect(canApplyTrackingEvent({ status: forward[current]!, lastEventAt: T0 }, { status: forward[next]!, occurredAt: after })).toBe(expected);
      }
    }
  });

  it("delivered y returned son terminales: nada los mueve, ni siquiera el otro terminal", () => {
    for (const terminal of TERMINAL_TRACKING_STATUSES) {
      for (const status of ALL) {
        expect(canApplyTrackingEvent({ status: terminal, lastEventAt: T0 }, { status, occurredAt: after })).toBe(false);
      }
    }
  });

  it("un evento terminal aplica sobre cualquier estado no terminal, aunque su hora sea más vieja (la entrega es la verdad final)", () => {
    for (const current of [S.LABEL_CREATED, S.PICKED_UP, S.IN_TRANSIT, S.OUT_FOR_DELIVERY, S.EXCEPTION]) {
      for (const terminal of TERMINAL_TRACKING_STATUSES) {
        expect(canApplyTrackingEvent({ status: current, lastEventAt: T0 }, { status: terminal, occurredAt: before })).toBe(true);
      }
    }
  });

  it("exception aplica sobre un avance o sobre otra exception SOLO si es más nueva", () => {
    for (const current of [S.LABEL_CREATED, S.PICKED_UP, S.IN_TRANSIT, S.OUT_FOR_DELIVERY, S.EXCEPTION]) {
      expect(canApplyTrackingEvent({ status: current, lastEventAt: T0 }, { status: S.EXCEPTION, occurredAt: after })).toBe(true);
      expect(canApplyTrackingEvent({ status: current, lastEventAt: T0 }, { status: S.EXCEPTION, occurredAt: before })).toBe(false);
      expect(canApplyTrackingEvent({ status: current, lastEventAt: T0 }, { status: S.EXCEPTION, occurredAt: T0 })).toBe(false);
    }
  });

  it("tras una exception, un avance SOLO aplica si es más nuevo (el paquete se reanudó)", () => {
    for (const next of [S.PICKED_UP, S.IN_TRANSIT, S.OUT_FOR_DELIVERY]) {
      expect(canApplyTrackingEvent({ status: S.EXCEPTION, lastEventAt: T0 }, { status: next, occurredAt: after })).toBe(true);
      expect(canApplyTrackingEvent({ status: S.EXCEPTION, lastEventAt: T0 }, { status: next, occurredAt: before })).toBe(false);
    }
  });
});

describe("services/shipment-tracking-state — buildTrackingClaimFilter (misma regla, en Mongo)", () => {
  it("es consistente con canApplyTrackingEvent para TODAS las combinaciones (estado previo x evento x hora)", () => {
    // Evalúa el filtro a mano contra el estado previo: si el filtro y la
    // función pura divergieran, esta prueba lo detecta.
    function matches(filter: ReturnType<typeof buildTrackingClaimFilter>, current: { status: S; lastEventAt: Date } | undefined) {
      return filter.$or.some((clause) => {
        if ("tracking" in clause) return current === undefined;
        if (current === undefined) return false;
        const statusCond = clause["tracking.status"] as { $in: S[] };
        if (!statusCond.$in.includes(current.status)) return false;
        const timeCond = clause["tracking.lastEventAt"] as { $lt: Date } | undefined;
        return timeCond ? current.lastEventAt < timeCond.$lt : true;
      });
    }
    for (const eventStatus of ALL) {
      for (const occurredAt of [before, T0, after]) {
        const filter = buildTrackingClaimFilter({ status: eventStatus, occurredAt });
        expect(matches(filter, undefined)).toBe(canApplyTrackingEvent(undefined, { status: eventStatus, occurredAt }));
        for (const currentStatus of ALL) {
          const current = { status: currentStatus, lastEventAt: T0 };
          expect(matches(filter, current), `${currentStatus} <- ${eventStatus} @${occurredAt.toISOString()}`).toBe(
            canApplyTrackingEvent(current, { status: eventStatus, occurredAt }),
          );
        }
      }
    }
  });
});

describe("services/shipment-tracking-state — orderTargetFor", () => {
  it("picked_up / in_transit / out_for_delivery llevan la orden a shipped", () => {
    for (const status of [S.PICKED_UP, S.IN_TRANSIT, S.OUT_FOR_DELIVERY]) {
      expect(orderTargetFor(status)).toBe(OrderStatus.SHIPPED);
    }
  });

  it("delivered lleva la orden a delivered", () => {
    expect(orderTargetFor(S.DELIVERED)).toBe(OrderStatus.DELIVERED);
  });

  it("label_created, exception y returned NO mueven la orden", () => {
    for (const status of [S.LABEL_CREATED, S.EXCEPTION, S.RETURNED]) {
      expect(orderTargetFor(status)).toBeNull();
    }
  });
});
