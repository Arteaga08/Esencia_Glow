import type { SubscriptionSettings } from "../types/settings.js";

/** Un array de ítems de edición sin techo es un DoS del documento contra sí
 * mismo — mismo criterio que MAX_STATUS_HISTORY (commerce.ts). */
const MAX_EDITION_ITEMS = 20;

/** Fotos y viñetas de "qué incluye" de un plan (Milestone 2.7c). Viven en
 * `shared` para que el editor del panel valide con los mismos números que el
 * servidor. */
const MAX_PLAN_IMAGES = 8;
const MAX_PLAN_HIGHLIGHTS = 6;
const MAX_PLAN_HIGHLIGHT_LENGTH = 120;

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
  MAX_PLAN_IMAGES,
  MAX_PLAN_HIGHLIGHTS,
  MAX_PLAN_HIGHLIGHT_LENGTH,
  DEFAULT_SUBSCRIPTION_SETTINGS,
  SUBSCRIPTION_ENROLLMENT_DEFAULT_DAYS,
  SUBSCRIPTION_ANCHOR_GAP_DAYS,
};
