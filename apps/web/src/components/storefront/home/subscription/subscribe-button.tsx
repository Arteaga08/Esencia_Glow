import Link from "next/link";

interface SubscribeButtonProps {
  className?: string;
}

/**
 * Botón de alta. Mientras la suscripción no se venda en la tienda dice
 * "Próximamente" y lleva a la página de aviso (/suscripcion); cuando exista el
 * alta vuelve a ser "Suscribirme" (o "Agotado" si el plan no tiene cupo).
 */
function SubscribeButton({ className = "" }: SubscribeButtonProps) {
  const base =
    "inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-md border px-6 py-3 type-shop-cta whitespace-nowrap " +
    "border-foreground bg-surface text-foreground transition-colors duration-[var(--duration-base)] ease-out-quart hover:bg-primary " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

  return (
    <Link href="/suscripcion" className={`${base} ${className}`}>
      Próximamente
    </Link>
  );
}

export { SubscribeButton };
