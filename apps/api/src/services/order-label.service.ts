import {
  DisputeStatus,
  LABEL_BACKOFF_BASE_MINUTES,
  LABEL_MAX_ATTEMPTS,
  LABEL_PURCHASE_TIMEOUT_MS,
  OrderAction,
  OrderStatus,
  ShippingLabelStatus,
} from "@esencia-glow/shared";
import { logger } from "../config/logger.js";
import { runWithDeadline } from "../utils/run-with-deadline.js";
import { Order } from "../models/order.model.js";
import { recordAudit } from "./audit.service.js";
import { toPlainParcel, toPlainShippingAddress } from "./create-order-mappers.js";
import type { LeanOrder } from "./order-dto.js";
import {
  computeBackoffMs,
  recordLabelFailure,
  recordLabelNeedsReview,
  recordLabelSuccess,
  type LabelClaimToken,
} from "./order-label-result.js";
import { getSettings } from "./settings.service.js";
import {
  ShippingProviderError,
  resolveShippingProvider,
  type PurchaseLabelInput,
  type ShippingLabelResult,
  type ShippingProvider,
} from "./shipping-provider.js";

/**
 * Compra de la guía de envío DESPUÉS de que el pago se confirmó (Milestone
 * 1.9). Una guía se paga con créditos prepagados, así que la garantía central
 * es que JAMÁS se compre dos veces:
 *
 * - el claim es un CAS (`pending|failed` -> `requested`), así que dos procesos
 *   nunca compran a la vez;
 * - un rechazo EXPLÍCITO del proveedor (nada se creó) se reintenta con
 *   backoff, hasta `LABEL_MAX_ATTEMPTS`;
 * - cualquier desenlace dudoso (timeout o corte a media compra, excepción
 *   inesperada, proceso muerto) va a `needs_review` — nunca se recompra sola;
 * - el resultado se escribe con fencing (`order-label-result.ts`).
 *
 * Nunca lanza: lo invocan el webhook de pago (fire-and-forget) y el job.
 */

type ProcessLabelOutcome =
  | "ready"
  | "processing"
  | "failed"
  | "needs_review"
  | "stale"
  | "skipped_not_claimable"
  | "skipped_no_provider";

interface ProcessOrderLabelOptions {
  now?: Date;
  provider?: ShippingProvider;
  timeoutMs?: number;
}

const MAX_ERROR_LENGTH = 500;

const MISSING_ORIGIN_REASON = "Falta la dirección de origen en la configuración de envíos.";
const MISSING_RATE_REASON = "El pedido no tiene la tarifa del proveedor de envíos.";
const PREPARE_ERROR_REASON = "Error interno al preparar la compra de la guía; se reintentará.";
const UNEXPECTED_ERROR_REASON = "Error inesperado al comprar la guía; no se sabe si el proveedor la cobró.";

/** Claim atómico. Excluye contracargos abiertos: no se gastan créditos en
 * mercancía que no se debe despachar (al cerrarse la disputa, el job la
 * retoma). */
async function claimLabel(orderId: string, now: Date): Promise<LeanOrder | null> {
  return Order.findOneAndUpdate(
    {
      _id: orderId,
      status: { $in: [OrderStatus.PAID, OrderStatus.PROCESSING] },
      "label.status": { $in: [ShippingLabelStatus.PENDING, ShippingLabelStatus.FAILED] },
      "label.nextAttemptAt": { $lte: now },
      disputeStatus: { $ne: DisputeStatus.OPEN },
    },
    { $set: { "label.status": ShippingLabelStatus.REQUESTED, "label.requestedAt": now }, $inc: { "label.attempts": 1 } },
    { new: true },
  ).lean<LeanOrder>();
}

/** Compra con deadline duro (`runWithDeadline`). Vencerlo es `unknown_outcome`
 * — la compra pudo haberse ejecutado, así que NUNCA se trata como un fallo
 * seguro de reintentar. */
function purchaseWithDeadline(
  provider: ShippingProvider,
  input: PurchaseLabelInput,
  timeoutMs: number,
): Promise<ShippingLabelResult> {
  return runWithDeadline(
    (signal) => provider.purchaseLabel(input, { signal }),
    timeoutMs,
    (cause) =>
      new ShippingProviderError(
        "unknown_outcome",
        "Se agotó el tiempo de espera del proveedor; no se sabe si cobró la guía.",
        cause === undefined ? undefined : { cause },
      ),
  );
}

function truncate(message: string): string {
  return message.length > MAX_ERROR_LENGTH ? `${message.slice(0, MAX_ERROR_LENGTH - 1)}…` : message;
}

async function processOrderLabel(
  orderId: string,
  options: ProcessOrderLabelOptions = {},
): Promise<{ outcome: ProcessLabelOutcome }> {
  try {
    return await runProcessOrderLabel(orderId, options);
  } catch (error) {
    logger.error({ err: error, orderId }, "Fallo inesperado al procesar la guía de envío");
    return { outcome: "skipped_not_claimable" };
  }
}

async function runProcessOrderLabel(
  orderId: string,
  options: ProcessOrderLabelOptions,
): Promise<{ outcome: ProcessLabelOutcome }> {
  const now = options.now ?? new Date();
  const provider = options.provider ?? resolveShippingProvider();
  if (!provider) {
    // Sin credenciales (503): no se consume el intento, el job la retoma
    // cuando haya proveedor configurado.
    logger.warn({ orderId }, "Guía pendiente: no hay proveedor de envíos configurado");
    return { outcome: "skipped_no_provider" };
  }

  const claimed = await claimLabel(orderId, now);
  if (!claimed) return { outcome: "skipped_not_claimable" };

  const token: LabelClaimToken = { requestedAt: now, attempts: claimed.label!.attempts };
  await recordAudit({ action: OrderAction.LABEL_REQUESTED, targetId: orderId, metadata: { attempt: token.attempts } });

  const review = async (reason: string) => {
    const written = await recordLabelNeedsReview(orderId, token, reason, now);
    return { outcome: (written ? "needs_review" : "stale") as ProcessLabelOutcome };
  };

  // Precondiciones de configuración: nada que reintentar hasta que el admin
  // lo corrija, así que van directo a revisión (con alerta), sin llamar al
  // proveedor ni gastar nada.
  let origin;
  try {
    origin = (await getSettings()).shipping.origin;
  } catch (error) {
    // Nada se ha enviado al proveedor todavía: es un fallo seguro de
    // reintentar. Sin este try, el error escaparía al catch exterior y la guía
    // se quedaría `requested` hasta que el barrido de leases la mandara a
    // revisión con un falso "no se sabe si el proveedor cobró".
    logger.error({ err: error, orderId }, "No se pudo leer la configuración de envíos antes de comprar la guía");
    return handleSafeFailure(orderId, token, PREPARE_ERROR_REASON, now);
  }
  if (!origin) return review(MISSING_ORIGIN_REASON);
  const providerShipping = claimed.providerShipping;
  if (!providerShipping?.providerRateId) return review(MISSING_RATE_REASON);
  if (providerShipping.provider !== provider.name) {
    return review(
      `La tarifa pertenece a otro proveedor de envíos (${providerShipping.provider}), no al configurado (${provider.name}).`,
    );
  }

  const input: PurchaseLabelInput = {
    orderId,
    orderNumber: claimed.orderNumber,
    providerRateId: providerShipping.providerRateId,
    ...(providerShipping.providerQuoteId ? { providerQuoteId: providerShipping.providerQuoteId } : {}),
    origin,
    destination: toPlainShippingAddress(claimed.shippingAddress),
    parcel: toPlainParcel(claimed.parcel),
    // Estable por pedido: un adapter que soporte idempotencia devuelve la
    // MISMA guía ante un reintento, en vez de comprar otra.
    idempotencyKey: `label-${orderId}`,
  };

  let result: ShippingLabelResult;
  try {
    result = await purchaseWithDeadline(provider, input, options.timeoutMs ?? LABEL_PURCHASE_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof ShippingProviderError && error.kind !== "unknown_outcome") {
      return handleSafeFailure(orderId, token, error.message, now);
    }
    if (!(error instanceof ShippingProviderError)) {
      logger.error({ err: error, orderId }, "Excepción inesperada del proveedor de envíos al comprar la guía");
    }
    return review(error instanceof ShippingProviderError ? truncate(error.message) : UNEXPECTED_ERROR_REASON);
  }

  let written: boolean;
  try {
    written = await recordLabelSuccess(orderId, token, result, now);
  } catch (error) {
    // La compra SÍ ocurrió y no pudimos guardarla: el resultado solo existe en
    // memoria. Se deja en el log (sin PII: ids y número de rastreo) para poder
    // recuperarla a mano; el barrido de leases mandará la guía a revisión.
    logger.error({ err: error, orderId, providerResult: result }, "Se compró la guía pero no se pudo guardar el resultado");
    throw error;
  }
  if (!written) return { outcome: "stale" };
  return { outcome: result.status };
}

/** Rechazo explícito (nada se creó): reintenta con backoff hasta el tope; al
 * agotarlo pasa a revisión. */
async function handleSafeFailure(
  orderId: string,
  token: LabelClaimToken,
  rawReason: string,
  now: Date,
): Promise<{ outcome: ProcessLabelOutcome }> {
  const reason = truncate(rawReason);
  if (token.attempts >= LABEL_MAX_ATTEMPTS) {
    const written = await recordLabelNeedsReview(orderId, token, reason, now);
    return { outcome: written ? "needs_review" : "stale" };
  }
  const nextAttemptAt = new Date(now.getTime() + computeBackoffMs(token.attempts, LABEL_BACKOFF_BASE_MINUTES));
  const written = await recordLabelFailure(orderId, token, reason, nextAttemptAt);
  return { outcome: written ? "failed" : "stale" };
}

export { processOrderLabel };
export type { ProcessLabelOutcome, ProcessOrderLabelOptions };
