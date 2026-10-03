interface SubscribeButtonProps {
  soldOut: boolean;
  className?: string;
}

/**
 * Botón de alta. Hoy es solo visual: el alta de suscripción todavía no existe
 * en la tienda (mismo criterio que el "Agregar" del carrito). Reposo: rosa
 * suave con borde `primary-action`, como "Ver todo" pero relleno.
 */
function SubscribeButton({ soldOut, className = "" }: SubscribeButtonProps) {
  const base =
    "inline-flex min-h-11 w-full items-center justify-center rounded-md border px-6 py-3 type-shop-cta whitespace-nowrap " +
    "transition-colors duration-[var(--duration-base)] ease-out-quart " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const tone = soldOut
    ? "cursor-not-allowed border-border-strong bg-muted text-muted-foreground-strong"
    : "cursor-pointer border-primary-action bg-primary text-foreground hover:bg-[oklch(0.82_0.0851_6.1876)]";

  return (
    <button type="button" disabled={soldOut} className={`${base} ${tone} ${className}`}>
      {soldOut ? "Agotado" : "Suscribirme"}
    </button>
  );
}

export { SubscribeButton };
