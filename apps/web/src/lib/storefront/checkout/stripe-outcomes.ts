/**
 * Traducción de lo que responde Stripe.js al vocabulario del checkout, en
 * funciones puras. El mensaje de Stripe ya viene en español (el Elements se
 * crea con `locale: "es-419"`); solo se usa uno propio si no trae ninguno.
 */
type ConfirmOutcome =
  /** Stripe aceptó el intento; quien decide "pagado" es el webhook. */
  | { status: "submitted" }
  /** El banco rechazó: se avisa pegado al formulario de tarjeta y se puede reintentar. */
  | { status: "declined"; message: string }
  /** Datos del formulario incompletos o inválidos. */
  | { status: "invalid"; message: string }
  /** El intent ya no admite confirmación (ya se pagó): ir a la confirmación. */
  | { status: "already" }
  | { status: "error"; message: string };

interface StripeErrorLike {
  type?: string;
  code?: string;
  message?: string;
}

const DECLINED_MESSAGE = "Tu banco rechazó el pago. Revisa los datos o prueba con otra tarjeta.";
const GENERIC_MESSAGE = "No pudimos procesar el pago. Revisa tu conexión e inténtalo de nuevo.";

function mapStripeError(error: StripeErrorLike): ConfirmOutcome {
  if (error.code === "payment_intent_unexpected_state") return { status: "already" };
  if (error.type === "card_error") return { status: "declined", message: error.message || DECLINED_MESSAGE };
  if (error.type === "validation_error") return { status: "invalid", message: error.message || "Revisa los datos de tu tarjeta." };
  return { status: "error", message: GENERIC_MESSAGE };
}

type IntentOutcome = "submitted" | "declined" | "error";

function mapIntentStatus(status: string): IntentOutcome {
  if (status === "succeeded" || status === "processing") return "submitted";
  if (status === "requires_payment_method") return "declined";
  return "error";
}

export { mapStripeError, mapIntentStatus, DECLINED_MESSAGE, GENERIC_MESSAGE };
export type { ConfirmOutcome, IntentOutcome, StripeErrorLike };
