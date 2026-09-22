/**
 * Cómo falló una llamada al proveedor de envíos. La distinción existe por
 * una razón de dinero: una guía se paga con créditos prepagados, así que
 * comprar dos veces es gastar dos veces.
 *
 * - `rejected`: el proveedor respondió con un rechazo explícito (4xx,
 *   validación, sin créditos). No se creó nada — es seguro reintentar.
 * - `unavailable`: la llamada ni siquiera salió o el proveedor dijo
 *   explícitamente que no está disponible (503). No se creó nada — es
 *   seguro reintentar.
 * - `unknown_outcome`: timeout o corte de red A MITAD de una operación que
 *   pudo haberse ejecutado. NO se sabe si el proveedor cobró — nunca se
 *   reintenta sola, se manda a revisión humana.
 *
 * Vive en su propio archivo (no en `shipping-provider.ts`) para que el stub
 * y los adapters puedan lanzarlo sin importar el resolver, que a su vez
 * importa al stub.
 */
type ShippingProviderErrorKind = "rejected" | "unavailable" | "unknown_outcome";

class ShippingProviderError extends Error {
  readonly kind: ShippingProviderErrorKind;

  constructor(kind: ShippingProviderErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ShippingProviderError";
    this.kind = kind;
  }
}

export { ShippingProviderError };
export type { ShippingProviderErrorKind };
