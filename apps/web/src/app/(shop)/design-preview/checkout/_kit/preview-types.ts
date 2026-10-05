import type { PublicShippingAddress, PublicShippingRate } from "@esencia-glow/shared";

/**
 * Formas de los datos de ejemplo de las tres propuestas de carrito y checkout.
 * Las tarifas y la dirección usan los DTO reales de `@esencia-glow/shared`
 * para que, al montar la versión real, solo cambie de dónde vienen los datos.
 */
interface PreviewLine {
  id: string;
  kind: "product" | "kit";
  brand?: string;
  name: string;
  /** Presentación elegida ("30 ml") o "N productos" en un kit. */
  variantLabel: string;
  priceCents: number;
  /** Precio tachado, solo presentación. */
  listPriceCents?: number;
  quantity: number;
  image?: { url: string; alt: string };
  available: boolean;
}

interface PreviewData {
  lines: PreviewLine[];
  rates: PublicShippingRate[];
  address: PublicShippingAddress;
  email: string;
  firstName: string;
  orderNumber: string;
}

/** Vistas que puede mostrar cada propuesta, en el orden del recorrido de compra. */
const PREVIEW_VIEWS = ["panel", "carrito", "cuenta", "envio", "pago", "listo"] as const;
type PreviewView = (typeof PREVIEW_VIEWS)[number];

const VIEW_LABELS: Record<PreviewView, string> = {
  panel: "Panel",
  carrito: "Carrito",
  cuenta: "Cuenta",
  envio: "Envío",
  pago: "Pago",
  listo: "Listo",
};

/** Estados alternativos por vista (`?estado=`). La vista base no lleva ninguno. */
const VIEW_STATES: Record<PreviewView, Array<{ key: string; label: string }>> = {
  panel: [
    { key: "vacio", label: "Vacío" },
    { key: "agotado", label: "Agotado" },
  ],
  carrito: [
    { key: "vacio", label: "Vacío" },
    { key: "agotado", label: "Agotado" },
  ],
  cuenta: [
    { key: "nueva", label: "Crear cuenta" },
    { key: "verificar", label: "Revisa tu correo" },
    { key: "sesion", label: "Con sesión" },
  ],
  envio: [
    { key: "cotizando", label: "Cotizando" },
    { key: "error", label: "Error de cotización" },
  ],
  pago: [
    { key: "oxxo", label: "OXXO" },
    { key: "rechazado", label: "Pago rechazado" },
  ],
  listo: [{ key: "oxxo", label: "OXXO" }],
};

export { PREVIEW_VIEWS, VIEW_LABELS, VIEW_STATES };
export type { PreviewLine, PreviewData, PreviewView };
