"use client";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CommerceSettingsCard } from "@/components/settings/commerce-settings-card";
import { ShippingOriginCard } from "@/components/settings/shipping-origin-card";
import type { SettingsActions } from "@/components/settings/settings-actions";
import { useAppSettings } from "@/components/settings/use-app-settings";

/**
 * Ajustes del negocio (Milestone 2.8) — Comercio y Dirección de origen,
 * Propuesta A elegida por Manuel de tres presentadas en `/settings/preview`
 * (borrado tras la elección): página única con tarjetas apiladas. Pagos
 * OXXO e Inventario no se exponen aquí; la ventana de inscripciones y el
 * día de cobro de suscripciones viven en Suscripciones → Cuentas.
 *
 * Settings no tiene control de versión (a diferencia del home, 1.8): cada
 * tarjeta guarda su propia sección y última escritura gana — ver
 * [[esencia-glow-2-8]].
 */
export default function SettingsPage() {
  const { settings, loadError, refresh, updateCommerce, updateShippingOrigin } = useAppSettings();

  if (loadError) {
    return <ErrorState description={loadError} onRetry={refresh} />;
  }

  if (!settings) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // El hook ya aplica la sección devuelta a su propio estado (última
  // escritura gana, ver [[esencia-glow-2-8]]); las tarjetas solo necesitan
  // disparar la escritura, no repetir esa lógica.
  const actions: SettingsActions = { updateCommerce, updateShippingOrigin };

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <CommerceSettingsCard
        settings={settings.commerce}
        reservationTtlMinutes={settings.inventory.reservationTtlMinutes}
        actions={actions}
      />
      <ShippingOriginCard settings={settings.shipping} actions={actions} />
    </div>
  );
}
