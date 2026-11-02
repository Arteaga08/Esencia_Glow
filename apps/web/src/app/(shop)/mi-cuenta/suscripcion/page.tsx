import { redirect } from "next/navigation";

/**
 * Mientras la suscripción no se venda, "Mi suscripción" lleva a la página de
 * "Próximamente". Para reactivarla, volver a pintar aquí `SubscriptionSection`
 * con `fetchAccountData("/api/v1/subscriptions/me")`, como antes de este cambio.
 */
export default function SubscriptionPage() {
  redirect("/suscripcion");
}
