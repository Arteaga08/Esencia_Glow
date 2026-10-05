import "server-only";
import { ShippingCarrier, type PublicShippingAddress, type PublicShippingRate } from "@esencia-glow/shared";
import { getShelfKits, getShelfProducts } from "@/lib/storefront/shelf";
import type { ShelfItem } from "@/lib/storefront/shelf-item";
import type { PreviewData, PreviewLine } from "./preview-types";

const RATES: PublicShippingRate[] = [
  { rateId: "rate-estafeta", carrier: ShippingCarrier.ESTAFETA, service: "Terrestre", amountCents: 9900, currency: "MXN", estimatedDays: 5 },
  { rateId: "rate-fedex", carrier: ShippingCarrier.FEDEX, service: "Express", amountCents: 14900, currency: "MXN", estimatedDays: 2 },
  { rateId: "rate-dhl", carrier: ShippingCarrier.DHL, service: "Día siguiente", amountCents: 21900, currency: "MXN", estimatedDays: 1 },
];

const ADDRESS: PublicShippingAddress = {
  fullName: "María Fernanda López",
  phone: "3312345678",
  street: "Av. Vallarta",
  exteriorNumber: "1234",
  interiorNumber: "Depto 4B",
  neighborhood: "Americana",
  city: "Guadalajara",
  state: "Jalisco",
  postalCode: "44160",
  references: "Casa azul, portón negro",
};

// Respaldo si el API no responde: la vista previa sigue mostrando el diseño.
const FALLBACK_LINES: PreviewLine[] = [
  { id: "fb-1", kind: "product", brand: "Esencia Glow", name: "Sérum Vitamina C", variantLabel: "30 ml", priceCents: 54900, quantity: 2, available: true },
  { id: "fb-2", kind: "product", brand: "Esencia Glow", name: "Limpiador Espuma Suave", variantLabel: "150 ml", priceCents: 28900, quantity: 1, available: true },
  { id: "fb-3", kind: "kit", name: "Kit Rutina Esencial", variantLabel: "3 productos", priceCents: 89900, quantity: 1, available: true },
];

function toLine(item: ShelfItem, quantity: number): PreviewLine {
  const image = item.images[0];
  return {
    id: item.id,
    kind: item.kind,
    brand: item.brand,
    name: item.name,
    variantLabel: item.quantityLabel,
    priceCents: item.priceCents,
    listPriceCents: item.listPriceCents,
    quantity,
    image: image ? { url: image.url, alt: image.alt ?? item.name } : undefined,
    available: true,
  };
}

/**
 * Carrito de ejemplo armado con productos y un kit reales del API (para que
 * las fotos y los precios se vean como en la tienda). Con menos de tres
 * artículos o sin API usa el respaldo estático.
 */
async function getPreviewData(): Promise<PreviewData> {
  const [products, kits] = await Promise.all([getShelfProducts(false), getShelfKits(3)]);
  const picks: PreviewLine[] = [];
  if (products[0]) picks.push(toLine(products[0], 2));
  if (products[1]) picks.push(toLine(products[1], 1));
  if (kits[0]) picks.push(toLine(kits[0], 1));
  else if (products[2]) picks.push(toLine(products[2], 1));

  return {
    lines: picks.length >= 3 ? picks : FALLBACK_LINES,
    rates: RATES,
    address: ADDRESS,
    email: "maria.lopez@correo.mx",
    firstName: "María",
    orderNumber: "EG-7KQ4M2XR",
  };
}

export { getPreviewData };
