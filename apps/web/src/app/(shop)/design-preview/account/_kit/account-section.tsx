import { AddressesSection } from "./addresses-section";
import { BillingSection } from "./billing-section";
import type { AccountData } from "./fixture";
import type { Tone } from "./frame";
import { OrdersSection } from "./orders-section";
import { ProfileSection } from "./profile-section";
import { SavedSection } from "./saved-section";
import { SubscriptionSection } from "./subscription-section";
import type { AccountView } from "./types";

interface AccountSectionProps {
  view: Exclude<AccountView, "inicio">;
  state: string | null;
  /** Ruta de la propuesta, p. ej. `/design-preview/account/a`. */
  base: string;
  tone: Tone;
  data: AccountData;
}

/** Contenido de una sección de Mi cuenta, sin título ni marco de página: lo pone cada propuesta. */
function AccountSection({ view, state, base, tone, data }: AccountSectionProps) {
  switch (view) {
    case "perfil":
      return <ProfileSection tone={tone} state={state} base={base} user={data.user} />;
    case "direcciones":
      return <AddressesSection tone={tone} state={state} base={base} addresses={data.addresses} />;
    case "pedidos":
      return <OrdersSection tone={tone} state={state} base={base} orders={data.orders} address={data.addresses[0]!} />;
    case "suscripcion":
      return <SubscriptionSection tone={tone} state={state} base={base} subscription={data.subscription} />;
    case "facturacion":
      return <BillingSection tone={tone} state={state} base={base} billing={data.billing} />;
    case "guardados":
      return <SavedSection tone={tone} state={state} saved={data.saved} />;
  }
}

export { AccountSection };
