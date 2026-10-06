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

export { stepStatuses };
export type { StepStatus, StepStatuses, StepInputs };
