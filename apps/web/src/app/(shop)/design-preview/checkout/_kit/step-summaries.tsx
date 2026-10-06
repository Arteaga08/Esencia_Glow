import Link from "next/link";
import type { PublicShippingAddress, PublicShippingRate } from "@esencia-glow/shared";
import { TEXT_LINK } from "@/components/storefront/cart/cta-styles";
import { rateSummary } from "./shipping-labels";

/** Un paso ya terminado, en dos renglones y con "Cambiar": así se ve en el acordeón y en la página única. */
function AccountDone({ firstName, email, changeHref }: { firstName: string; email: string; changeHref: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-subtitle text-foreground">Compras como {firstName}</p>
        <p className="truncate text-body-sm text-muted-foreground-strong">{email}</p>
      </div>
      <Link href={changeHref} className={TEXT_LINK}>
        Cambiar
      </Link>
    </div>
  );
}

function ShippingDone({ address, rate, changeHref }: { address: PublicShippingAddress; rate: PublicShippingRate; changeHref: string }) {
  const street = [address.street, address.exteriorNumber, address.interiorNumber].filter(Boolean).join(" ");

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-subtitle text-foreground">{address.fullName}</p>
        <p className="text-body-sm text-muted-foreground-strong">
          {street}, {address.neighborhood}. {address.city}, {address.state}, {address.postalCode}
        </p>
        <p className="mt-1 text-body-sm text-foreground">{rateSummary(rate)}</p>
      </div>
      <Link href={changeHref} className={TEXT_LINK}>
        Cambiar
      </Link>
    </div>
  );
}

export { AccountDone, ShippingDone };
