import { Types, type ClientSession } from "mongoose";
import { EditionStatus, SubscriptionAction } from "@esencia-glow/shared";
import { Inventory } from "../models/inventory.model.js";
import { SubscriptionEdition } from "../models/subscription-edition.model.js";
import { SubscriptionShipment, type SubscriptionShipmentDocument } from "../models/subscription-shipment.model.js";
import type { ReservedShipmentItemAttrs } from "../models/reserved-shipment-item.schema.js";
import { isDuplicateKeyError } from "../utils/duplicate-key-error.js";
import { withTransaction } from "../utils/with-transaction.js";
import { resolveCycleFromDate } from "../utils/resolve-cycle.js";
import { recordAudit } from "./audit.service.js";
import { sendSubscriptionAdminIncidentEmail } from "./subscription-email.service.js";

/**
 * `createCycleShipment` — la transacción de la caja del ciclo (Fase 3 de
 * 1.7.2a, §D del plan). Un faltante (edición o inventario) NUNCA rechaza: el
 * cobro ya ocurrió. Solo `Inventory.reserved`, nunca `StockReservation` (esa
 * colección se barre por TTL y soltaría en silencio el stock de una caja ya
 * cobrada — ver el docstring del modelo).
 *
 * Los DOS E11000 se distinguen RELEYENDO la base tras el `catch`, nunca
 * inspeccionando la forma del error del driver: si existe una caja con este
 * `invoiceId`, es una reentrega (`replayed`); si no, pero existe una con
 * `{accountId, cycleYear, cycleMonth}`, es una factura distinta para un
 * ciclo que ya tiene caja (`duplicate_cycle`). El `catch` va FUERA de
 * `withTransaction` — un E11000 aborta la transacción del lado del servidor,
 * seguir escribiendo en la misma transacción siempre falla (mismo motivo que
 * documenta `subscription-seat.service.ts::startSubscription`). Es seguro:
 * dentro de una transacción, un choque con una escritura de OTRA transacción
 * sin commitear llega como WriteConflict (que `withTransaction` reintenta),
 * nunca como E11000 — cuando vemos un E11000, el documento ganador ya está
 * commiteado y esta relectura lo ve.
 */

interface CreateCycleShipmentInput {
  accountId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  planId: Types.ObjectId | string;
  invoiceRef: string;
  servicePeriodStart: Date;
}

type CreateCycleShipmentOutcome =
  | { outcome: "created"; shipment: SubscriptionShipmentDocument }
  | { outcome: "replayed"; shipment: SubscriptionShipmentDocument }
  | { outcome: "duplicate_cycle"; shipment: SubscriptionShipmentDocument };

/**
 * Cajas mensuales 2-12 de una cuenta ANUAL (Milestone 2.7b): el webhook de
 * Stripe solo dispara `invoice.paid` una vez al año, así que
 * `jobs/create-prepaid-cycle-shipments.ts` llama esto en cada tick para el
 * ciclo en curso. `cycleYear`/`cycleMonth` viajan sueltos (no hay
 * `servicePeriodStart` que resolver: el job ya sabe el ciclo). SIN
 * `invoiceRef`: la única idempotencia que hace falta es el índice único de
 * `{accountId, cycleYear, cycleMonth}` — no hay reentrega de webhook que
 * distinguir de una anomalía de negocio, así que no existe el desenlace
 * `duplicate_cycle` aquí.
 */
interface CreatePrepaidCycleShipmentInput {
  accountId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  planId: Types.ObjectId | string;
  /** Factura ANUAL que ya cubrió este ciclo — informativa, ver el docstring
   * de `SubscriptionShipmentAttrs.prepaidInvoiceId`. */
  coveringInvoiceRef: string;
  cycleYear: number;
  cycleMonth: number;
}

type CreatePrepaidCycleShipmentOutcome =
  | { outcome: "created"; shipment: SubscriptionShipmentDocument }
  | { outcome: "replayed"; shipment: SubscriptionShipmentDocument };

/** Fusiona por `variantId` (dos líneas de la misma variante en una edición
 * son válidas) y ordena por el hex canónico — calco de `normalizeLines` en
 * stock-reservation.service.ts: first-writer-wins consistente si dos cajas
 * de ciclos distintos compitieran por las mismas variantes. */
function normalizeEditionItems(items: { variantId: Types.ObjectId; quantity: number }[]): Map<string, number> {
  const merged = new Map<string, number>();
  for (const item of items) {
    const key = item.variantId.toString();
    merged.set(key, (merged.get(key) ?? 0) + item.quantity);
  }
  return new Map([...merged.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** Reserva lo que alcance de cada línea, todo-o-nada POR ÍTEM (nunca una
 * reserva parcial de la cantidad de una misma variante): el `$expr` de
 * `stock-reservation.service.ts::reserveStock` sin el `throw` — un faltante
 * se acumula en `inventoryIncident`, nunca aborta la transacción. */
async function reserveWhatIsAvailable(
  orderedLines: Map<string, number>,
  session: ClientSession,
): Promise<{ reservedItems: ReservedShipmentItemAttrs[]; inventoryIncident: boolean }> {
  const reservedItems: ReservedShipmentItemAttrs[] = [];
  let inventoryIncident = false;

  for (const [variantId, quantity] of orderedLines) {
    const updated = await Inventory.findOneAndUpdate(
      {
        variantId: new Types.ObjectId(variantId),
        $expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, quantity] },
      },
      { $inc: { reserved: quantity } },
      { new: true, session },
    );
    if (updated) {
      reservedItems.push({ variantId: updated.variantId, quantity });
    } else {
      inventoryIncident = true;
    }
  }

  return { reservedItems, inventoryIncident };
}

/** Documento base común a `createCycleShipment` (mensual, `invoiceId`) y
 * `createPrepaidCycleShipment` (anual, `prepaidInvoiceId`) — misma
 * transacción: edición del ciclo, reserva lo que alcance, sella
 * `firstBilledAt` una sola vez. El identificador de factura viaja en el
 * campo que corresponda, nunca los dos a la vez. */
interface ShipmentSeedFields {
  accountId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  planId: Types.ObjectId | string;
  cycleYear: number;
  cycleMonth: number;
  invoiceId?: string;
  prepaidInvoiceId?: string;
}

async function runShipmentTransaction(seed: ShipmentSeedFields): Promise<SubscriptionShipmentDocument> {
  return withTransaction(async (session) => {
    const edition = await SubscriptionEdition.findOne({
      planId: seed.planId,
      cycleYear: seed.cycleYear,
      cycleMonth: seed.cycleMonth,
      status: EditionStatus.PUBLISHED,
    }).session(session);

    const editionIncident = !edition;

    const [createdDoc] = await SubscriptionShipment.create(
      [
        {
          accountId: seed.accountId,
          userId: seed.userId,
          planId: seed.planId,
          editionId: edition?._id,
          cycleYear: seed.cycleYear,
          cycleMonth: seed.cycleMonth,
          ...(seed.invoiceId ? { invoiceId: seed.invoiceId } : {}),
          ...(seed.prepaidInvoiceId ? { prepaidInvoiceId: seed.prepaidInvoiceId } : {}),
          editionIncident,
          ...(editionIncident ? { adminAlertedAt: new Date() } : {}),
        },
      ],
      { session },
    );
    const created = createdDoc as SubscriptionShipmentDocument;

    if (!edition) {
      return created;
    }

    const orderedLines = normalizeEditionItems(edition.items);
    const { reservedItems, inventoryIncident } = await reserveWhatIsAvailable(orderedLines, session);

    // Sello condicional: jamás queda sellada una edición por un envío que
    // no commiteó, y jamás se re-sella si ya lo estaba (otra cuenta del
    // mismo plan cobró primero este mismo ciclo).
    await SubscriptionEdition.findOneAndUpdate(
      { _id: edition._id, firstBilledAt: { $exists: false } },
      { $set: { firstBilledAt: new Date() } },
      { session },
    );

    const updated = await SubscriptionShipment.findByIdAndUpdate(
      created._id,
      {
        $set: {
          reservedItems,
          inventoryIncident,
          ...(inventoryIncident ? { adminAlertedAt: new Date() } : {}),
        },
      },
      { new: true, session },
    );
    return updated as SubscriptionShipmentDocument;
  });
}

/** Auditoría + correo de incidencia — idéntico para las dos fuentes
 * (mensual y prepagada): la clienta ya pagó en ambos casos, así que el
 * criterio de alerta no depende de cómo llegó el cobro. */
async function emitShipmentCreationSideEffects(
  shipment: SubscriptionShipmentDocument,
  planId: Types.ObjectId | string,
  accountId: Types.ObjectId | string,
  cycleYear: number,
  cycleMonth: number,
): Promise<void> {
  await recordAudit({
    action: SubscriptionAction.SHIPMENT_CREATED,
    targetId: shipment._id,
    metadata: { accountId: accountId.toString(), cycleYear, cycleMonth },
  });
  if (shipment.editionIncident) {
    await recordAudit({
      action: SubscriptionAction.SHIPMENT_EDITION_MISSING,
      targetId: shipment._id,
      metadata: { planId: planId.toString(), cycleYear, cycleMonth },
    });
    void sendSubscriptionAdminIncidentEmail({
      shipmentId: shipment._id.toString(),
      reason: "edition_missing",
      cycleYear,
      cycleMonth,
    });
  }
  if (shipment.inventoryIncident) {
    await recordAudit({
      action: SubscriptionAction.SHIPMENT_INVENTORY_SHORTAGE,
      targetId: shipment._id,
      metadata: { cycleYear, cycleMonth },
    });
    void sendSubscriptionAdminIncidentEmail({
      shipmentId: shipment._id.toString(),
      reason: "inventory_shortage",
      cycleYear,
      cycleMonth,
    });
  }
}

async function createCycleShipment(input: CreateCycleShipmentInput): Promise<CreateCycleShipmentOutcome> {
  const { cycleYear, cycleMonth } = resolveCycleFromDate(input.servicePeriodStart);

  try {
    const shipment = await runShipmentTransaction({ ...input, cycleYear, cycleMonth, invoiceId: input.invoiceRef });
    await emitShipmentCreationSideEffects(shipment, input.planId, input.accountId, cycleYear, cycleMonth);
    return { outcome: "created", shipment };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;

    const byInvoice = await SubscriptionShipment.findOne({ invoiceId: input.invoiceRef });
    if (byInvoice) {
      // Reentrega de la MISMA factura: éxito idempotente, nunca se alerta.
      // El inventario no se re-reservó porque la transacción abortó completa.
      return { outcome: "replayed", shipment: byInvoice };
    }

    const byCycle = await SubscriptionShipment.findOne({
      accountId: input.accountId,
      cycleYear,
      cycleMonth,
    });
    if (byCycle) {
      // Factura DISTINTA para un ciclo que ya tiene caja: anomalía de
      // negocio. La invariante manda (una caja por ciclo) — se sella la
      // alerta UNA sola vez y se audita con el invoiceId intruso.
      const sealed = await SubscriptionShipment.findOneAndUpdate(
        { _id: byCycle._id, adminAlertedAt: { $exists: false } },
        { $set: { adminAlertedAt: new Date() } },
        { new: true },
      );
      if (sealed) {
        await recordAudit({
          action: SubscriptionAction.SUBSCRIPTION_DUPLICATE_CYCLE_INVOICE,
          targetId: byCycle._id,
          metadata: { invoiceId: input.invoiceRef, accountId: input.accountId.toString() },
        });
        void sendSubscriptionAdminIncidentEmail({
          shipmentId: byCycle._id.toString(),
          reason: "duplicate_cycle_invoice",
          cycleYear,
          cycleMonth,
        });
      }
      return { outcome: "duplicate_cycle", shipment: sealed ?? byCycle };
    }

    // Ni por invoiceId ni por ciclo: el documento ganador de la carrera
    // todavía no es visible en este read (extremadamente improbable fuera
    // de un fallo de red entre el abort y esta relectura) — se relanza, es
    // transitorio.
    throw error;
  }
}

/**
 * Cajas prepagadas de una cuenta ANUAL (Milestone 2.7b) — llamado por
 * `jobs/create-prepaid-cycle-shipments.ts` en cada tick para el ciclo en
 * curso. Sin `invoiceId`: la única idempotencia que hace falta es el índice
 * único de `{accountId, cycleYear, cycleMonth}`, así que un E11000 aquí
 * SIEMPRE es un reintento del mismo job sobre el mismo ciclo — nunca una
 * anomalía de negocio que alertar (a diferencia de `createCycleShipment`,
 * donde un E11000 puede significar una factura duplicada real).
 */
async function createPrepaidCycleShipment(
  input: CreatePrepaidCycleShipmentInput,
): Promise<CreatePrepaidCycleShipmentOutcome> {
  try {
    const shipment = await runShipmentTransaction({
      ...input,
      prepaidInvoiceId: input.coveringInvoiceRef,
    });
    await emitShipmentCreationSideEffects(shipment, input.planId, input.accountId, input.cycleYear, input.cycleMonth);
    return { outcome: "created", shipment };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;

    const byCycle = await SubscriptionShipment.findOne({
      accountId: input.accountId,
      cycleYear: input.cycleYear,
      cycleMonth: input.cycleMonth,
    });
    if (byCycle) return { outcome: "replayed", shipment: byCycle };

    // Mismo caso transitorio que documenta `createCycleShipment`.
    throw error;
  }
}

export { createCycleShipment, createPrepaidCycleShipment };
export type {
  CreateCycleShipmentInput,
  CreateCycleShipmentOutcome,
  CreatePrepaidCycleShipmentInput,
  CreatePrepaidCycleShipmentOutcome,
};
