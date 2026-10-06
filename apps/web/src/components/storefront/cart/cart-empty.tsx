import Link from "next/link";
import { ShoppingBag } from "@phosphor-icons/react/ssr";
import { CTA_SECONDARY } from "./cta-styles";

/** Carrito vacío: explica cómo llenarlo con un botón secundario (un vacío no empuja la acción más fuerte). */
function CartEmpty({ className = "", onNavigate }: { className?: string; onNavigate?: () => void }) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-16 text-center ${className}`}>
      <ShoppingBag size={32} className="text-muted-foreground" aria-hidden="true" />
      <p className="text-subtitle text-foreground">Tu carrito está vacío</p>
      <p className="max-w-[36ch] text-body-sm text-muted-foreground-strong">Agrega algo de tu rutina y aquí verás el resumen de tu compra.</p>
      <Link href="/" onClick={onNavigate} className={`${CTA_SECONDARY} mt-2`}>
        Ver lo más vendido
      </Link>
    </div>
  );
}

export { CartEmpty };
