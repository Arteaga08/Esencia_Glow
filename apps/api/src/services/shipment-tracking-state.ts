import { OrderStatus, ShipmentTrackingStatus as S } from "@esencia-glow/shared";

/**
 * Reglas puras del rastreo de un envío (Milestone 1.9). Los proveedores de
 * paquetería entregan eventos duplicados y fuera de orden, así que el estado
 * del rastreo (`Order.tracking`) solo puede AVANZAR, nunca retroceder.
 *
 * Una sola tabla (`PRIOR_RULES`) es la fuente de verdad de "qué evento puede
 * mover a qué estado previo", y de ella se derivan tanto la función pura
 * (`canApplyTrackingEvent`) como el filtro atómico de Mongo
 * (`buildTrackingClaimFilter`): no pueden divergir (hay una prueba que las
 * compara para todas las combinaciones).
 */

const TERMINAL_TRACKING_STATUSES: readonly S[] = [S.DELIVERED, S.RETURNED];

/** Avance lineal, de menor a mayor. `delivered` es terminal y va aparte. */
const FORWARD_STATUSES: readonly S[] = [S.LABEL_CREATED, S.PICKED_UP, S.IN_TRANSIT, S.OUT_FOR_DELIVERY];

interface PriorRule {
  /** Estados previos desde los que el evento aplica sin importar la hora. */
  unconditional: readonly S[];
  /** Estados previos desde los que aplica SOLO si el evento es más nuevo que
   * el último aplicado (`lastEventAt`). */
  ifNewer: readonly S[];
}

function buildPriorRule(event: S): PriorRule {
  if (TERMINAL_TRACKING_STATUSES.includes(event)) {
    // La entrega/devolución es la verdad final: aplica sobre cualquier estado
    // no terminal, aunque su hora sea más vieja que la de una incidencia.
    return { unconditional: [...FORWARD_STATUSES, S.EXCEPTION], ifNewer: [] };
  }
  if (event === S.EXCEPTION) {
    return { unconditional: [], ifNewer: [...FORWARD_STATUSES, S.EXCEPTION] };
  }
  const rank = FORWARD_STATUSES.indexOf(event);
  return {
    // Solo si estrictamente mayor rango que el previo...
    unconditional: FORWARD_STATUSES.slice(0, rank),
    // ...o si el paquete se reanudó tras una incidencia (evento más nuevo).
    ifNewer: [S.EXCEPTION],
  };
}

const PRIOR_RULES: Readonly<Record<S, PriorRule>> = Object.fromEntries(
  Object.values(S).map((status) => [status, buildPriorRule(status)]),
) as Record<S, PriorRule>;

interface TrackingEventCandidate {
  status: S;
  occurredAt: Date;
}

interface CurrentTracking {
  status: S;
  lastEventAt: Date;
}

function canApplyTrackingEvent(current: CurrentTracking | undefined, event: TrackingEventCandidate): boolean {
  if (!current) return true;
  const rule = PRIOR_RULES[event.status];
  if (rule.unconditional.includes(current.status)) return true;
  return rule.ifNewer.includes(current.status) && current.lastEventAt < event.occurredAt;
}

type TrackingClaimClause =
  | { tracking: { $exists: false } }
  | { "tracking.status": { $in: S[] }; "tracking.lastEventAt"?: { $lt: Date } };

/** El mismo criterio que `canApplyTrackingEvent`, como filtro de un
 * `findOneAndUpdate`: el CAS del rastreo es atómico, no una lectura previa. */
function buildTrackingClaimFilter(event: TrackingEventCandidate): { $or: TrackingClaimClause[] } {
  const rule = PRIOR_RULES[event.status];
  const clauses: TrackingClaimClause[] = [{ tracking: { $exists: false } }];
  if (rule.unconditional.length > 0) clauses.push({ "tracking.status": { $in: [...rule.unconditional] } });
  if (rule.ifNewer.length > 0) {
    clauses.push({ "tracking.status": { $in: [...rule.ifNewer] }, "tracking.lastEventAt": { $lt: event.occurredAt } });
  }
  return { $or: clauses };
}

/** A qué estado de la orden lleva un evento de rastreo (`null` = ninguno). */
function orderTargetFor(status: S): OrderStatus | null {
  if (status === S.PICKED_UP || status === S.IN_TRANSIT || status === S.OUT_FOR_DELIVERY) return OrderStatus.SHIPPED;
  if (status === S.DELIVERED) return OrderStatus.DELIVERED;
  return null;
}

export { TERMINAL_TRACKING_STATUSES, canApplyTrackingEvent, buildTrackingClaimFilter, orderTargetFor };
export type { TrackingEventCandidate, CurrentTracking };
