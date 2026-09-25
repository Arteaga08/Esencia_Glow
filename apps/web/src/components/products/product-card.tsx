"use client";

import Link from "next/link";
import { Archive, PencilSimple, Trash } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatMoneyMXN } from "@/lib/format-money";
import type { AdminBadge, AdminCategory, AdminProduct } from "@/lib/types/admin-catalog";

interface ProductCardProps {
  product: AdminProduct;
  category?: AdminCategory;
  badge?: AdminBadge;
  onTogglePublish: (product: AdminProduct, nextActive: boolean) => void;
  onArchive: (product: AdminProduct) => void;
  togglingPublish: boolean;
}

/**
 * Diseño B aprobado por Manuel (Milestone 2.2.1, Fase 2) — grilla editorial,
 * sin sombra en reposo, sin zoom de foto, precio+SKU apilados con una sola
 * línea divisoria arriba, Editar/Archivar al pie sin línea divisoria propia.
 * `minPrice` se muestra como "desde $X" solo cuando hay más de una variante
 * — con una sola variante, el "desde" es ruido (siempre hay un único precio
 * posible).
 */
function ProductCard({
  product,
  category,
  badge,
  onTogglePublish,
  onArchive,
  togglingPublish,
}: ProductCardProps) {
  const primaryVariant = product.variants[0];
  const hasMultipleVariants = product.variants.length > 1;
  const isArchived = product.status === "archived";
  const photo = product.images[0];

  return (
    <div className="overflow-hidden rounded-lg border border-border-strong bg-surface">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={photo.alt ?? ""}
            className={"h-full w-full object-cover " + (isArchived ? "grayscale" : "")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-body-sm text-muted-foreground">
            Sin foto
          </div>
        )}
        {badge ? (
          // max-w-[70%]: dejar aire a la derecha para el sello "Archivado" y
          // para no tocar el borde de la tarjeta con un texto largo.
          <div className="absolute top-2 left-2 max-w-[70%]">
            <Badge color={badge.color}>{badge.text}</Badge>
          </div>
        ) : null}
        {isArchived ? (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
            <Archive size={12} aria-hidden="true" />
            Archivado
          </div>
        ) : null}
      </div>
      <div className="p-3">
        <p className="truncate text-body-sm font-medium text-foreground">{product.name}</p>
        <p className="mt-0.5 truncate text-body-sm text-muted-foreground-strong">
          {category?.name ?? "Sin categoría"}
        </p>

        <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
          <div className="font-mono text-data tabular-nums text-foreground">
            {primaryVariant?.listPrice ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground-strong line-through">
                  {formatMoneyMXN(primaryVariant.listPrice)}
                </span>
                <span>{formatMoneyMXN(product.minPrice)}</span>
              </div>
            ) : (
              <div>
                {hasMultipleVariants ? "desde " : ""}
                {formatMoneyMXN(product.minPrice)}
              </div>
            )}
            {primaryVariant ? (
              <p className="mt-0.5 text-body-sm text-muted-foreground-strong">
                SKU: {hasMultipleVariants ? `${primaryVariant.sku} +${product.variants.length - 1}` : primaryVariant.sku}
              </p>
            ) : null}
          </div>
          {!isArchived ? (
            <Switch
              checked={product.status === "active"}
              onChange={(checked) => onTogglePublish(product, checked)}
              label={`Publicar ${product.name}`}
              disabled={togglingPublish}
            />
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Link
            href={`/products/${product.id}`}
            className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-body-sm text-muted-foreground-strong hover:bg-muted hover:text-foreground"
          >
            <PencilSimple size={14} aria-hidden="true" />
            Editar
          </Link>
          {!isArchived ? (
            <button
              type="button"
              onClick={() => onArchive(product)}
              aria-label={`Archivar ${product.name}`}
              title="Archivar (no elimina, solo deja de mostrarse)"
              className="rounded-sm p-1.5 text-destructive-action hover:bg-destructive/30"
            >
              <Trash size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { ProductCard };
