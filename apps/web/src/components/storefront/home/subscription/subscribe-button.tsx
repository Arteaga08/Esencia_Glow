interface SubscribeButtonProps {
  className?: string;
}

/**
 * Botón de alta. Mientras la suscripción no se venda en la tienda va
 * deshabilitado y dice "Próximamente"; cuando exista el alta vuelve a ser
 * "Suscribirme" (o "Agotado" si el plan no tiene cupo).
 */
function SubscribeButton({ className = "" }: SubscribeButtonProps) {
  const base =
    "inline-flex min-h-11 w-full items-center justify-center rounded-md border px-6 py-3 type-shop-cta whitespace-nowrap " +
    "cursor-not-allowed border-border-strong bg-muted text-muted-foreground-strong";

  return (
    <button type="button" disabled className={`${base} ${className}`}>
      Próximamente
    </button>
  );
}

export { SubscribeButton };
