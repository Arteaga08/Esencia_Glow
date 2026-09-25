import type { ProductAttributes, PublicDimensionsCm, ProductContent } from "@esencia-glow/shared";

/**
 * Espejo manual de los DTOs admin que arma `apps/api/src/services/catalog-dto.ts`
 * (`AdminProduct`, `AdminVariant`, `AdminCategory`, `AdminBadge`). Esos DTOs
 * viven solo en la API — a diferencia de los `Public*` de
 * `@esencia-glow/shared`, no hay un paquete compartido para la forma admin,
 * así que este archivo es la única fuente de verdad del lado del panel.
 * Mantenerlo sincronizado a mano cuando el DTO cambie del lado de la API.
 */

type AdminProductStatus = "draft" | "active" | "archived";
type AdminProductChannel = "store" | "subscription";

interface AdminVariant {
  id: string;
  sku: string;
  name: string;
  attributes: ProductAttributes;
  /** Centavos. */
  price: number;
  /** Centavos, solo presentación — nunca lo que cobra el checkout. */
  listPrice?: number | null;
  weightGrams: number;
  dimensionsCm: PublicDimensionsCm;
  isActive: boolean;
}

interface AdminProductImage {
  id: string;
  url: string;
  width: number;
  height: number;
  alt?: string;
}

interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  categoryId: string;
  badgeId: string | null;
  status: AdminProductStatus;
  channel: AdminProductChannel;
  images: AdminProductImage[];
  variants: AdminVariant[];
  /** Centavos, derivado de las variantes activas. */
  minPrice: number;
  content?: ProductContent;
}

interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId: string | null;
  image?: AdminProductImage;
  sortOrder: number;
  isActive: boolean;
  /** Cuántas subcategorías tiene — solo se usa en una categoría raíz. */
  childrenCount?: number;
  /** Cuántos productos la usan — solo se usa en una subcategoría. */
  productCount?: number;
}

interface AdminBadge {
  id: string;
  text: string;
  color: "neutral" | "primary" | "success" | "warning" | "danger" | "info";
}

type AdminBundleStatus = "draft" | "active" | "archived";

interface AdminBundleItem {
  productId: string;
  variantId: string;
  quantity: number;
}

/**
 * Espejo de `AdminBundle` (bundle-dto.ts, Milestone 2.2.3). A diferencia de
 * `AdminProduct.variants`, `items` viaja SIN enriquecer — solo ids y
 * cantidad; el panel cruza nombre/foto contra `/admin/products` del lado del
 * cliente (ver bundle-composition-editor.tsx).
 */
interface AdminBundle {
  id: string;
  name: string;
  slug: string;
  description: string;
  images: AdminProductImage[];
  /** Centavos. Manual, independiente de la suma de sus componentes. */
  price: number;
  /** Centavos, solo presentación — nunca lo que cobra el checkout. */
  listPrice: number | null;
  badgeId: string | null;
  items: AdminBundleItem[];
  content?: ProductContent;
  status: AdminBundleStatus;
  /** Caché de display, no fuente de verdad — ver bundle-availability.service.ts. */
  stockCache: number;
}

export type {
  AdminProductStatus,
  AdminProductChannel,
  AdminVariant,
  AdminProductImage,
  AdminProduct,
  AdminCategory,
  AdminBadge,
  AdminBundleStatus,
  AdminBundleItem,
  AdminBundle,
};
