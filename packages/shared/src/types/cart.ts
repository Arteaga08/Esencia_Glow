/**
 * Contrato de `POST /api/v1/cart/resolve`: el carrito vive en el navegador y
 * solo manda QUÉ lleva (tipo + id), nunca cantidades ni montos. El servidor
 * responde con el precio y la disponibilidad vivos de cada línea.
 */
interface ResolveCartLineInput {
  itemType: "product" | "bundle";
  /** `variantId` para un producto, `bundleId` para un kit. */
  itemId: string;
}

interface ResolveCartInput {
  lines: ResolveCartLineInput[];
}

/**
 * Una línea resuelta. Lo que no se puede vender (inexistente, archivado,
 * variante inactiva, canal suscripción, kit inactivo) vuelve SOLO con
 * `available: false`, sin datos: así un borrador nunca se filtra. Lo que sí
 * se vende pero está agotado vuelve completo con `available: false`.
 */
interface PublicCartLine {
  itemType: "product" | "bundle";
  itemId: string;
  available: boolean;
  slug?: string;
  name?: string;
  brand?: string;
  /** Presentación ("30 ml") o "N productos" en un kit. */
  variantLabel?: string;
  priceCents?: number;
  /** Precio tachado, solo presentación. */
  listPriceCents?: number;
  image?: { url: string; alt?: string };
}

export type { ResolveCartLineInput, ResolveCartInput, PublicCartLine };
