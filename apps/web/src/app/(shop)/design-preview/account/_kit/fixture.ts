import "server-only";
import type { PublicShippingAddress } from "@esencia-glow/shared";
import { getHomeContent } from "@/lib/storefront/home";
import { getShelfProducts } from "@/lib/storefront/shelf";
import type { ShelfItem } from "@/lib/storefront/shelf-item";

/**
 * Datos de ejemplo de Mi Cuenta. Los productos y la foto del acceso son reales
 * del API (para que se vea como la tienda); la persona, las direcciones, los
 * pedidos y los cobros son inventados. Las fechas son fijas (hoy es 5 oct 2026
 * en esta vista previa) para que las capturas no cambien de un día a otro.
 */
interface DemoProduct {
  id: string;
  brand?: string;
  name: string;
  variantLabel: string;
  priceCents: number;
  listPriceCents?: number;
  image?: { url: string; alt: string };
  available: boolean;
}

type DemoOrderStatus = "pending" | "preparing" | "shipped" | "delivered";

interface DemoOrder {
  id: string;
  number: string;
  createdAt: string;
  status: DemoOrderStatus;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  lines: Array<DemoProduct & { quantity: number }>;
  shipping: string;
  trackingNumber?: string;
  /** Solo en pedidos con ficha OXXO sin pagar. */
  oxxo?: { reference: string; expiresAt: string };
}

interface DemoAddress extends PublicShippingAddress {
  id: string;
  label: string;
  isDefault: boolean;
}

interface DemoSubscription {
  planName: string;
  priceCents: number;
  intervalLabel: string;
  nextChargeAt: string;
  nextBoxShipsAt: string;
  cardLabel: string;
  charges: Array<{ id: string; at: string; amountCents: number }>;
}

interface DemoBilling {
  rfc: string;
  legalName: string;
  cfdiUse: string;
  fiscalRegime: string;
  postalCode: string;
}

interface AccountData {
  user: { firstName: string; lastName: string; email: string; phone: string; birthDate: string; city: string; passwordChangedAt: string };
  addresses: DemoAddress[];
  orders: DemoOrder[];
  subscription: DemoSubscription;
  billing: DemoBilling;
  saved: DemoProduct[];
  /** Foto editorial de la propuesta A (la del hero del home). */
  authPhoto: { url: string; alt: string } | null;
}

const FALLBACK_PRODUCTS: DemoProduct[] = [
  { id: "fb-1", brand: "Esencia Glow", name: "Sérum Vitamina C", variantLabel: "30 ml", priceCents: 54900, listPriceCents: 64900, available: true },
  { id: "fb-2", brand: "Esencia Glow", name: "Limpiador Espuma Suave", variantLabel: "150 ml", priceCents: 28900, available: true },
  { id: "fb-3", brand: "Esencia Glow", name: "Crema Hidratante Noche", variantLabel: "50 ml", priceCents: 43900, available: true },
  { id: "fb-4", brand: "Esencia Glow", name: "Polvo Exfoliante de Avena", variantLabel: "60 g", priceCents: 31900, available: true },
];

function toDemo(item: ShelfItem): DemoProduct {
  const image = item.images[0];
  return {
    id: item.id,
    brand: item.brand,
    name: item.name,
    variantLabel: item.quantityLabel,
    priceCents: item.priceCents,
    listPriceCents: item.listPriceCents,
    image: image ? { url: image.url, alt: image.alt ?? item.name } : undefined,
    available: true,
  };
}

const ADDRESS_BASE = {
  fullName: "María Fernanda López",
  phone: "3312345678",
  state: "Jalisco",
} as const;

const ADDRESSES: DemoAddress[] = [
  { ...ADDRESS_BASE, id: "ad-1", label: "Casa", isDefault: true, street: "Av. Vallarta", exteriorNumber: "1234", interiorNumber: "Depto 4B", neighborhood: "Americana", city: "Guadalajara", postalCode: "44160", references: "Casa azul, portón negro" },
  { ...ADDRESS_BASE, id: "ad-2", label: "Oficina", isDefault: false, street: "Av. Chapultepec Sur", exteriorNumber: "480", neighborhood: "Americana", city: "Guadalajara", postalCode: "44160", references: "Recepción del piso 3" },
  { ...ADDRESS_BASE, id: "ad-3", label: "Mamá", isDefault: false, street: "Calle Hidalgo", exteriorNumber: "77", neighborhood: "Centro", city: "Zapopan", postalCode: "45100" },
  { ...ADDRESS_BASE, fullName: "Daniela López", id: "ad-4", label: "Hermana", isDefault: false, street: "Calzada Independencia", exteriorNumber: "2210", interiorNumber: "5", neighborhood: "Independencia", city: "Guadalajara", postalCode: "44340" },
  { ...ADDRESS_BASE, id: "ad-5", label: "Casa de playa", isDefault: false, street: "Paseo de las Palmas", exteriorNumber: "15", neighborhood: "Zona Hotelera", city: "Puerto Vallarta", postalCode: "48333" },
];

/** Reúne todo lo que necesitan las tres propuestas. Nunca falla: sin API usa el respaldo. */
async function getAccountData(): Promise<AccountData> {
  const [shelf, home] = await Promise.all([getShelfProducts(false), getHomeContent()]);
  const products = shelf.length >= 4 ? shelf.slice(0, 4).map(toDemo) : FALLBACK_PRODUCTS;
  const [a, b, c, d] = products as [DemoProduct, DemoProduct, DemoProduct, DemoProduct];

  const slide = home?.hero?.slides[0];
  const authPhoto = slide ? { url: slide.images.desktop.url, alt: "" } : null;

  const orders: DemoOrder[] = [
    {
      id: "or-3",
      number: "EG-7KQ4M2XR",
      createdAt: "2026-10-05T10:20:00Z",
      status: "pending",
      subtotalCents: a.priceCents * 2 + b.priceCents,
      shippingCents: 9900,
      totalCents: a.priceCents * 2 + b.priceCents + 9900,
      lines: [
        { ...a, quantity: 2 },
        { ...b, quantity: 1 },
      ],
      shipping: "Estafeta Terrestre",
      oxxo: { reference: "9300 1234 5678 90", expiresAt: "2026-10-07T23:59:00Z" },
    },
    {
      id: "or-2",
      number: "EG-4HT9WD3B",
      createdAt: "2026-09-28T16:05:00Z",
      status: "shipped",
      subtotalCents: c.priceCents,
      shippingCents: 9900,
      totalCents: c.priceCents + 9900,
      lines: [{ ...c, quantity: 1 }],
      shipping: "FedEx Express",
      trackingNumber: "7762 4410 8821",
    },
    {
      id: "or-1",
      number: "EG-2MB6PL8Z",
      createdAt: "2026-09-02T11:40:00Z",
      status: "delivered",
      subtotalCents: d.priceCents + b.priceCents,
      shippingCents: 0,
      totalCents: d.priceCents + b.priceCents,
      lines: [
        { ...d, quantity: 1 },
        { ...b, quantity: 1 },
      ],
      shipping: "Estafeta Terrestre",
      trackingNumber: "8820 4417 3391",
    },
  ];

  return {
    user: {
      firstName: "María Fernanda",
      lastName: "López Martínez",
      email: "maria.lopez@correo.mx",
      phone: "3312345678",
      birthDate: "1991-03-12",
      city: "Guadalajara",
      passwordChangedAt: "2026-08-12T12:00:00Z",
    },
    addresses: ADDRESSES,
    orders,
    subscription: {
      planName: "Caja Esencia",
      priceCents: 69900,
      intervalLabel: "cada mes",
      nextChargeAt: "2026-11-05T12:00:00Z",
      nextBoxShipsAt: "2026-11-08T12:00:00Z",
      cardLabel: "Visa terminada en 4242",
      charges: [
        { id: "ch-3", at: "2026-10-05T12:00:00Z", amountCents: 69900 },
        { id: "ch-2", at: "2026-09-05T12:00:00Z", amountCents: 69900 },
        { id: "ch-1", at: "2026-08-05T12:00:00Z", amountCents: 69900 },
      ],
    },
    billing: {
      rfc: "LOMM910312AB1",
      legalName: "María Fernanda López Martínez",
      cfdiUse: "G03 Gastos en general",
      fiscalRegime: "612 Personas físicas con actividades empresariales y profesionales",
      postalCode: "44160",
    },
    saved: products.map((product, index) => ({ ...product, available: index !== 2 })),
    authPhoto,
  };
}

export { getAccountData };
export type { AccountData, DemoProduct, DemoOrder, DemoOrderStatus, DemoAddress, DemoSubscription, DemoBilling };
