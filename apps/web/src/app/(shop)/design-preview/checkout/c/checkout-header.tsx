import Link from "next/link";
import { LockKey } from "@phosphor-icons/react/ssr";
import { BrandLogo } from "@/components/storefront/layout/header/brand-logo";
import { TEXT_LINK } from "../_kit/cta-styles";

/**
 * Header mínimo del checkout: solo marca, salida al carrito y la señal de
 * pago seguro. Sin menú ni buscador, para que nada distraiga del pago. Se
 * pinta encima del header de la tienda (mismas alturas) solo en esta propuesta.
 */
function CheckoutHeader({ cartHref }: { cartHref: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-[60] border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between gap-6 px-4 md:px-8 xl:h-20 xl:px-12">
        <BrandLogo />
        <div className="flex items-center gap-5">
          <p className="hidden items-center gap-1.5 text-body-sm text-muted-foreground-strong sm:flex">
            <LockKey size={16} aria-hidden="true" />
            Pago seguro
          </p>
          <Link href={cartHref} className={TEXT_LINK}>
            Volver al carrito
          </Link>
        </div>
      </div>
    </header>
  );
}

export { CheckoutHeader };
