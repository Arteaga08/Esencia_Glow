import type { ReservationStatus, StockStatus } from "@esencia-glow/shared";

/**
 * Espejo manual de los DTOs de inventario del panel: `PanelProductRow`,
 * `PanelVariantRow` y `ProductInventoryDetail` salen de
 * `apps/api/src/services/inventory-panel.service.ts`; `AdminReservation`, de
 * `apps/api/src/services/inventory-dto.ts`. Igual que `admin-shipment.ts`: no
 * hay paquete compartido para la forma admin, así que mantener sincronizado a
 * mano cuando el DTO cambie del lado de la API.
 */

/** Categoría directa del producto (normalmente una subcategoría). */
interface PanelCategoryRef {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

/** Primera foto del producto (su portada); `null` si todavía no tiene fotos. */
interface PanelProductImage {
  url: string;
  alt: string | null;
}

/** Una fila por producto, nunca por SKU: las cifras son la suma de las
 * variantes que sí tienen fila de `Inventory`. */
interface PanelProductRow {
  productId: string;
  name: string;
  slug: string;
  image: PanelProductImage | null;
  category: PanelCategoryRef | null;
  variantCount: number;
  untrackedVariantCount: number;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  status: StockStatus;
  updatedAt: string;
}

/** `data` de `GET /admin/inventory`: el único listado del panel cuyo `data`
 * es objeto y no array. `statusCounts` se calcula antes del filtro de
 * `status` (y después de `search`/`categoryId`). */
interface InventoryListData {
  items: PanelProductRow[];
  statusCounts: Record<StockStatus, number>;
}

/** Variante sin fila de `Inventory` → cifras `null` y `status: untracked`.
 * `effectiveLowStockThreshold` lo resuelve el servidor, nunca el cliente. */
interface PanelVariantRow {
  variantId: string;
  sku: string;
  name: string;
  inventoryItemId: string | null;
  onHand: number | null;
  reserved: number | null;
  available: number | null;
  lowStockThreshold: number | null;
  effectiveLowStockThreshold: number;
  status: StockStatus;
}

interface ProductInventoryDetail extends PanelProductRow {
  variants: PanelVariantRow[];
}

/** Los opcionales se omiten cuando no existen (no vienen como `null`). */
interface AdminReservation {
  id: string;
  cartRef: string;
  userId?: string;
  lines: { variantId: string; sku: string; quantity: number }[];
  status: ReservationStatus;
  expiresAt: string;
  purgeAt?: string;
  committedAt?: string;
  releasedAt?: string;
}

export type {
  PanelCategoryRef,
  PanelProductImage,
  PanelProductRow,
  InventoryListData,
  PanelVariantRow,
  ProductInventoryDetail,
  AdminReservation,
};
