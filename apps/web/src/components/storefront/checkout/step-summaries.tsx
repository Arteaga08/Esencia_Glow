import type { PublicShippingAddress, PublicShippingRate } from "@esencia-glow/shared";
import { DELIVERY_LABELS, type DeliveryMethod } from "@/lib/storefront/delivery";
import { rateSummary } from "@/lib/storefront/checkout/shipping-labels";
import { TEXT_LINK } from "../cart/cta-styles";

interface AccountDoneProps {
  firstName: string;
  email: string;
  /** Sin él no hay cambio de cuenta: con el pedido ya creado la cuenta queda fija. */
  onSwitch?: () => void;
}

/** Un paso ya terminado, en dos renglones y con su acción para cambiarlo. */
function AccountDone({ firstName, email, onSwitch }: AccountDoneProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-subtitle text-foreground">Compras como {firstName}</p>
        <p className="truncate text-body-sm text-muted-foreground-strong">{email}</p>
      </div>
      {onSwitch ? (
        <button type="button" onClick={onSwitch} className={TEXT_LINK}>
          No soy {firstName}
        </button>
      ) : null}
    </div>
  );
}

interface ShippingDoneProps {
  address: PublicShippingAddress;
  rate: Pick<PublicShippingRate, "carrier" | "service" | "amountCents" | "estimatedDays">;
  /** Sin él no hay "Cambiar": con el pedido ya creado el envío queda fijo. */
  onChange?: () => void;
}

function ShippingDone({ address, rate, onChange }: ShippingDoneProps) {
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
      {onChange ? (
        <button type="button" onClick={onChange} className={TEXT_LINK}>
          Cambiar
        </button>
      ) : null}
    </div>
  );
}

interface DeliveryDoneProps {
  method: DeliveryMethod;
  /** Ausente al recoger en tienda. */
  address: PublicShippingAddress | null;
  phone: string;
  onChange: () => void;
}

/** La entrega ya elegida del checkout por WhatsApp: forma, a dónde va y a qué celular se escribe. */
function DeliveryDone({ method, address, phone, onChange }: DeliveryDoneProps) {
  const street = address ? [address.street, address.exteriorNumber, address.interiorNumber].filter(Boolean).join(" ") : "";

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-subtitle text-foreground">{DELIVERY_LABELS[method]}</p>
        {address ? (
          <p className="text-body-sm text-muted-foreground-strong">
            {address.fullName}: {street}, {address.neighborhood}. {address.city}, {address.state}, {address.postalCode}
          </p>
        ) : null}
        <p className="text-body-sm text-muted-foreground-strong">Celular: {phone}</p>
      </div>
      <button type="button" onClick={onChange} className={TEXT_LINK}>
        Cambiar
      </button>
    </div>
  );
}

export { AccountDone, DeliveryDone, ShippingDone };
