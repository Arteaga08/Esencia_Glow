import { EditionStatus, SubscriptionAction } from "@esencia-glow/shared";
import { SubscriptionEdition } from "../models/subscription-edition.model.js";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import { nextAnchorOnOrAfter } from "../services/subscription-enrollment.js";
import { sendUpcomingEditionMissingEmail } from "../services/subscription-email.service.js";
import { recordAudit } from "../services/audit.service.js";
import { logger } from "../config/logger.js";

const DEFAULT_BATCH_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

interface AlertMissingEditionSummary {
  scanned: number;
  alerted: number;
  failed: number;
}

/**
 * Aviso preventivo de edición faltante (Milestone 1.7.2b, Fase 6).
 *
 * `createCycleShipment` ya tolera que falte la edición cuando el cobro
 * llega: crea la caja con `editionIncident` y alerta. Pero para entonces la
 * clienta YA fue cobrada por una caja sin contenido definido. Este job mueve
 * ese aviso a ANTES del cobro, que es cuando todavía se puede arreglar
 * publicando la edición.
 *
 * Solo mira planes activos CON suscriptoras (`seatsTaken > 0`): un plan que
 * nadie compró no va a cobrar nada este ciclo, y alertar por él sería ruido
 * que enseña al admin a ignorar estos correos.
 *
 * Idempotencia por ciclo vía `missingEditionAlertedFor` (`"YYYY-MM"`) con un
 * `findOneAndUpdate` condicional: el cron corre cada minuto, así que sin ese
 * sello el admin recibiría un correo por minuto durante una semana. El
 * claim va ANTES de enviar — mismo criterio que el sellado de `adminAlertedAt`
 * en `createCycleShipment`: dos instancias de la API compitiendo en el mismo
 * tick producen un solo correo, y el perdedor del claim simplemente no envía.
 */
async function alertMissingEdition(
  now: Date = new Date(),
  anchorDay: number,
  alertDays: number,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<AlertMissingEditionSummary> {
  const nextAnchor = nextAnchorOnOrAfter(now, anchorDay);
  // Fuera de la ventana de aviso no hay nada que hacer: se corta antes de
  // tocar la base, porque esto corre cada minuto y la mayoría del mes la
  // respuesta es "todavía falta mucho".
  if (nextAnchor.getTime() - now.getTime() > alertDays * DAY_MS) {
    return { scanned: 0, alerted: 0, failed: 0 };
  }

  // El ciclo se lee de los campos UTC del ancla, NO con `resolveCycleFromDate`
  // (hallazgo de code review): `nextAnchorOnOrAfter` construye la fecha con
  // `Date.UTC(...)` a partir de componentes de calendario YA resueltos en la
  // zona del negocio, así que esos campos UTC son el año/mes correctos.
  // Reconvertir ese instante a America/Mexico_City lo corre al día anterior
  // (medianoche UTC = 18:00 del día previo) y, con el `billingAnchorDay` por
  // default (1), al MES anterior — el job buscaba entonces la edición del mes
  // en curso, la encontraba publicada y no avisaba nunca.
  const cycleYear = nextAnchor.getUTCFullYear();
  const cycleMonth = nextAnchor.getUTCMonth() + 1;
  const cycleKey = `${cycleYear}-${String(cycleMonth).padStart(2, "0")}`;

  const plans = await SubscriptionPlan.find({
    isActive: true,
    seatsTaken: { $gt: 0 },
    missingEditionAlertedFor: { $ne: cycleKey },
  })
    .select("_id name")
    .limit(batchSize)
    .lean();

  let alerted = 0;
  let failed = 0;

  for (const plan of plans) {
    try {
      const edition = await SubscriptionEdition.findOne({
        planId: plan._id,
        cycleYear,
        cycleMonth,
        status: EditionStatus.PUBLISHED,
      })
        .select("_id")
        .lean();
      if (edition) continue;

      // Claim primero, correo después: si el claim pierde, otra instancia
      // (u otro tick) ya avisó por este ciclo.
      const claimed = await SubscriptionPlan.findOneAndUpdate(
        { _id: plan._id, missingEditionAlertedFor: { $ne: cycleKey } },
        { $set: { missingEditionAlertedFor: cycleKey } },
        { new: true },
      );
      if (!claimed) continue;

      await sendUpcomingEditionMissingEmail({
        planId: plan._id.toString(),
        planName: plan.name,
        cycleYear,
        cycleMonth,
      });
      await recordAudit({
        action: SubscriptionAction.SHIPMENT_EDITION_MISSING_UPCOMING,
        targetId: plan._id,
        metadata: { cycleYear, cycleMonth },
      });
      alerted += 1;
    } catch (error) {
      failed += 1;
      logger.error({ err: error, planId: plan._id.toString() }, "Fallo al avisar que falta la edición de un ciclo");
    }
  }

  return { scanned: plans.length, alerted, failed };
}

export { alertMissingEdition };
export type { AlertMissingEditionSummary };
