import type { CommerceSettings, ShippingSettings } from "@esencia-glow/shared";

/** Escrituras del panel de Ajustes que reciben las tarjetas — las implementa
 * quien las monta. La página real las arma a partir de `useAppSettings`
 * (para que la lectura y las dos mutaciones compartan un solo estado del
 * singleton); las previews de diseño usaron una versión que rechazaba toda
 * escritura, borrada junto con las rutas de preview tras la elección de
 * Manuel. Mismo patrón de "acciones inyectadas" que `PlanEditorActions`/
 * `EditionEditorActions` (2.7b-2). */
interface SettingsActions {
  updateCommerce: (patch: Partial<CommerceSettings>) => Promise<CommerceSettings>;
  updateShippingOrigin: (origin: Record<string, unknown>) => Promise<ShippingSettings>;
}

export type { SettingsActions };
