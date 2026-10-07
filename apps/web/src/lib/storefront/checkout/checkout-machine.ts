/**
 * Qué paso del checkout está activo, hecho o apagado. Los tres siempre se ven
 * (página única); avanzar no esconde nada: lo hecho queda como resumen y lo que
 * falta, apagado hasta habilitarse.
 */
type StepStatus = "done" | "active" | "upcoming";

interface StepInputs {
  signedIn: boolean;
  /** Ya hay una tarifa de envío elegida (cotización vigente). */
  hasRate: boolean;
}

interface StepStatuses {
  account: StepStatus;
  shipping: StepStatus;
  payment: StepStatus;
}

function stepStatuses({ signedIn, hasRate }: StepInputs): StepStatuses {
  if (!signedIn) return { account: "active", shipping: "upcoming", payment: "upcoming" };
  if (!hasRate) return { account: "done", shipping: "active", payment: "upcoming" };
  return { account: "done", shipping: "done", payment: "active" };
}

/** Las cuatro pantallas del checkout en móvil (una por paso; en escritorio siguen las tres secciones). */
type MobileScreen = "account" | "address" | "rates" | "payment";

interface MobileScreenInputs {
  signedIn: boolean;
  /** Hay una cotización vigente con tarifas para elegir. */
  quoteReady: boolean;
  /** Ya se confirmó la tarifa (o el pedido ya existe). */
  confirmed: boolean;
}

/** Posición de cada pantalla, para saber si un cambio avanza o retrocede. */
const SCREEN_ORDER: Record<MobileScreen, number> = { account: 0, address: 1, rates: 2, payment: 3 };

function mobileScreen({ signedIn, quoteReady, confirmed }: MobileScreenInputs): MobileScreen {
  if (!signedIn) return "account";
  if (confirmed) return "payment";
  return quoteReady ? "rates" : "address";
}

export { stepStatuses, mobileScreen, SCREEN_ORDER };
export type { StepStatus, StepStatuses, StepInputs, MobileScreen, MobileScreenInputs };
