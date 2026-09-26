import { CreditCard, Storefront } from "@phosphor-icons/react";
import { PaymentMethod } from "@esencia-glow/shared";

/** Junto al chip de estado de pago, no como badge propio — el método no
 * necesita competir visualmente con el estado, que es lo que importa. */
function PaymentMethodIcon({ method }: { method: PaymentMethod }) {
  const IconComponent = method === PaymentMethod.OXXO ? Storefront : CreditCard;
  const label = method === PaymentMethod.OXXO ? "Pago en OXXO" : "Pago con tarjeta";
  return (
    <IconComponent
      size={16}
      weight="regular"
      className="shrink-0 text-muted-foreground-strong"
      aria-label={label}
    />
  );
}

export { PaymentMethodIcon };
