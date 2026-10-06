import { MagnifyingGlass, ShoppingBag, User } from "@phosphor-icons/react/ssr";
import Link from "next/link";

const actionClass =
  "inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors duration-[var(--duration-fast)] hover:bg-foreground/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

/**
 * Buscar, cuenta y carrito. La cuenta va siempre a `/mi-cuenta`: con sesión
 * entra directo y sin ella el guard de esa ruta manda a `/ingresar` y regresa
 * (así el header no lee cookies y el home y el catálogo siguen cacheables).
 * El buscador y el carrito siguen siendo enlaces sin lógica (3.4).
 * En móvil la cuenta se oculta aquí: vive dentro del menú desplegable.
 */
function HeaderActions({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <Link href="/buscar" onClick={onNavigate} aria-label="Buscar productos" className={actionClass}>
        <MagnifyingGlass size={24} aria-hidden="true" />
      </Link>
      <Link
        href="/mi-cuenta"
        onClick={onNavigate}
        aria-label="Mi cuenta"
        className={`${actionClass} max-xl:hidden`}
      >
        <User size={24} aria-hidden="true" />
      </Link>
      <Link href="/carrito" onClick={onNavigate} aria-label="Carrito de compras" className={actionClass}>
        <ShoppingBag size={24} aria-hidden="true" />
      </Link>
    </div>
  );
}

export { HeaderActions };
