"use client";

import { useParams } from "next/navigation";
import { AccountDetailPanel } from "@/components/subscription-accounts/account-detail-panel";

/** Milestone 2.7a — detalle de una cuenta de suscripción. El contenido vive
 * en `AccountDetailPanel` (compartido con las 3 propuestas de diseño que ya
 * se evaluaron): la propuesta elegida por Manuel varió el listado, no el
 * detalle. */
export default function SubscriptionAccountDetailPage() {
  const params = useParams<{ id: string }>();
  return <AccountDetailPanel accountId={params.id} />;
}
