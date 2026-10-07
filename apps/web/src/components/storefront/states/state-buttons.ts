/**
 * Botones de las páginas de estado. Misma anatomía que el botón del banner de
 * oferta (`min-h-12`, voz `type-shop-cta`); el hover primario usa `primary`
 * porque estas páginas viven sobre la banda `blush`, donde `blush` no se vería.
 */
const BASE =
  "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md px-7 py-3 type-shop-cta text-foreground " +
  "transition-colors duration-[var(--duration-base)] ease-out-quart " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const STATE_PRIMARY_BUTTON = `${BASE} border border-foreground bg-surface hover:bg-primary`;
const STATE_SECONDARY_BUTTON = `${BASE} border border-primary-action hover:border-foreground hover:bg-surface/60`;

export { STATE_PRIMARY_BUTTON, STATE_SECONDARY_BUTTON };
