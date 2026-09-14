import type { SubscriptionSettings } from "../types/settings.js";

/** Un array de ítems de edición sin techo es un DoS del documento contra sí
 * mismo — mismo criterio que MAX_STATUS_HISTORY (commerce.ts). */
const MAX_EDITION_ITEMS = 20;

/**
 * Defaults del singleton de Settings, sección `subscriptions` (Milestone
 * 1.7.2a). `enrollmentOpen: false` por default: la admin abre las
 * inscripciones a mano, nunca abiertas por accidente al desplegar.
 */
const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettings = {
  billingAnchorDay: 1,
  enrollmentOpen: false,
};

/** Duración por default de una ventana de inscripciones al abrirla (decisión
 * de Manuel: "abre una ventana de 15 días y ya se cierra"). Configurable por
 * llamada, no una constante rígida — este es solo el valor que precarga el
 * panel. */
const SUBSCRIPTION_ENROLLMENT_DEFAULT_DAYS = 15;

/** Guarda contra el doble cargo en días consecutivos (riesgo 1.7.2a): abrir
 * una ventana que cierre a menos de esto del próximo `billingAnchorDay` se
 * rechaza al ABRIR la ventana, donde la admin puede corregirlo — no cuando a
 * la clienta ya le llegaron dos cargos en tres días. */
const SUBSCRIPTION_ANCHOR_GAP_DAYS = 7;

export {
  MAX_EDITION_ITEMS,
  DEFAULT_SUBSCRIPTION_SETTINGS,
  SUBSCRIPTION_ENROLLMENT_DEFAULT_DAYS,
  SUBSCRIPTION_ANCHOR_GAP_DAYS,
};
