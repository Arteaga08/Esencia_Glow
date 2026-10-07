/**
 * Botones del estante. Reposo: borde en `primary-action` (el rosa oscuro del
 * sistema; el rosa claro `primary` no llega a 3:1 como borde de un control).
 * Hover: el mismo esmerilado rosa del header (`blush` + blur + saturación).
 * Forma `rounded-md`, como todos los botones de DESIGN.md §5.
 */
const BUTTON_MOTION =
  "transition-[background-color,border-color,opacity,transform] duration-[var(--duration-base)] ease-out-quart " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const FROSTED_HOVER = `hover:bg-blush/70 hover:backdrop-blur-xl hover:backdrop-saturate-150 ${BUTTON_MOTION}`;

const VIEW_ALL_BASE =
  "inline-flex items-center justify-center rounded-md border border-primary-action bg-surface px-4 py-2.5 type-shop-cta text-foreground hover:border-foreground";

/** "Ver todo": texto en tinta, borde rosa, hover esmerilado. */
const VIEW_ALL_BUTTON = `${VIEW_ALL_BASE} ${FROSTED_HOVER}`;

/**
 * "Ver todo" sobre una banda `bg-blush`: ahí el esmerilado `blush` se funde con
 * el fondo, así que el hover sube al rosa pleno `primary` (como las flechas).
 */
const VIEW_ALL_BUTTON_ON_BLUSH = `${VIEW_ALL_BASE} hover:bg-primary ${BUTTON_MOTION}`;

/** Flechas del carrusel, flotando sobre las fotos: esmeriladas desde el reposo. */
const ARROW_BUTTON =
  "flex h-12 w-12 items-center justify-center rounded-md border border-primary-action bg-blush/70 text-foreground " +
  "backdrop-blur-xl backdrop-saturate-150 hover:bg-primary disabled:pointer-events-none " +
  "transition-[background-color,opacity,transform] duration-[var(--duration-base)] ease-out-quart " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export { VIEW_ALL_BUTTON, VIEW_ALL_BUTTON_ON_BLUSH, ARROW_BUTTON };
