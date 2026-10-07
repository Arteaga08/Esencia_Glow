import { MagnifyingGlass, User } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { CartButton } from "../../cart/cart-button";

const actionClass =
  "inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors duration-[var(--duration-fast)] hover:bg-foreground/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

/**
 * Buscar, cuenta y carrito. La cuenta va siempre a `/mi-cuenta`: con sesión
 * entra directo y sin ella el guard de esa ruta manda a `/ingresar` y regresa
 * (así el header no lee cookies y el home y el catálogo siguen cacheables).
 * El carrito es un botón con contador que abre el panel lateral (3.4a) y la
 * lupa abre el buscador (lo monta el header; aquí solo se avisa).
 * En móvil la lupa de aquí se oculta: el header la pinta a la izquierda,
 * junto al botón del menú, con `SearchButton`.
 */
function SearchButton({ onSearch, className = "" }: { onSearch: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label="Buscar productos"
      aria-haspopup="dialog"
      onClick={onSearch}
      className={`cursor-pointer ${actionClass} ${className}`}
    >
      <MagnifyingGlass size={24} aria-hidden="true" />
    </button>
  );
}

function HeaderActions({ onNavigate, onSearch }: { onNavigate?: () => void; onSearch: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <SearchButton onSearch={onSearch} className="max-xl:hidden" />
      <Link
        href="/mi-cuenta"
        onClick={onNavigate}
        aria-label="Mi cuenta"
        className={actionClass}
      >
        <User size={24} aria-hidden="true" />
      </Link>
      <CartButton onOpen={onNavigate} className={actionClass} />
    </div>
  );
}

export { HeaderActions, SearchButton };
