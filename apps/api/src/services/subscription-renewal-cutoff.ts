/**
 * Ventana previa al siguiente cobro en la que ya no se puede pausar ni cambiar
 * de plan: Stripe no garantiza detener (ni re-precificar) una factura que ya se
 * generó o finalizó justo antes del ancla. Pausar dejaría una caja cobrada sin
 * enviar (`paused_account_charged`); cambiar de plan dejaría que la caja
 * siguiera al plan nuevo aunque se cobró el viejo (auditoría run-2, hallazgo 12).
 */
const RENEWAL_CUTOFF_MS = 48 * 60 * 60 * 1000;

/** `true` si falta menos de `RENEWAL_CUTOFF_MS` para el siguiente cobro —o si
 * ya pasó y la renovación aún no se registró—. Sin `currentPeriodEnd` (cuenta
 * que todavía no se cobra) no hay cobro cercano que proteger. */
function isWithinRenewalCutoff(currentPeriodEnd: Date | undefined, now: Date): boolean {
  return Boolean(currentPeriodEnd) && currentPeriodEnd!.getTime() - now.getTime() < RENEWAL_CUTOFF_MS;
}

export { RENEWAL_CUTOFF_MS, isWithinRenewalCutoff };
