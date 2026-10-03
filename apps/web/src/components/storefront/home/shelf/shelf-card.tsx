"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { Badge, type BadgeColorValue } from "@/components/ui/badge";
import type { ShelfItem } from "@/lib/storefront/shelf-item";
import { PriceTag } from "./price-tag";
import { QuickAddPanel } from "./quick-add-panel";

const IMAGE_SIZES = "(min-width: 1024px) 22vw, (min-width: 640px) 42vw, 72vw";

/**
 * Tarjeta del estante. La foto es el enlace; al pasar el cursor cambia a la
 * segunda foto (si hay) y sube el panel de compra rápida. En táctil, el "+"
 * de la esquina abre ese mismo panel. `compact` (bloque Novedades/Kits): foto
 * cuadrada y sin descripción, para que el bloque sea menos alto.
 */
function ShelfCard({ item, priority = false, compact = false }: { item: ShelfItem; priority?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [primary, secondary] = item.images;

  return (
    <article className="group flex h-full flex-col">
      <div className={`relative overflow-hidden rounded-md bg-muted ${compact ? "aspect-square" : "aspect-[4/5]"}`}>
        <Link href={item.href} aria-label={item.name} className="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring">
          {primary ? (
            <Image src={primary.url} alt={primary.alt ?? ""} fill sizes={IMAGE_SIZES} priority={priority} className="object-cover" />
          ) : null}
          {secondary ? (
            <Image
              src={secondary.url}
              alt=""
              fill
              sizes={IMAGE_SIZES}
              className="object-cover opacity-0 transition-opacity duration-[var(--duration-slow)] ease-out-quart group-hover:opacity-100"
            />
          ) : null}
        </Link>
        {item.badge ? (
          <Badge color={item.badge.color as BadgeColorValue} className="pointer-events-none absolute left-3 top-3">
            {item.badge.text}
          </Badge>
        ) : null}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Cerrar compra rápida" : `Compra rápida de ${item.name}`}
          onClick={() => setOpen((value) => !value)}
          className="absolute right-3 top-3 hidden h-9 w-9 items-center justify-center rounded-md bg-surface/80 text-foreground backdrop-blur-xl [@media(hover:none)]:flex"
        >
          {open ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
        </button>
        <QuickAddPanel item={item} open={open} />
      </div>

      <div className="flex flex-1 flex-col pt-4">
        {item.brand || item.kind === "kit" ? (
          <p className="mb-1 font-mono text-label uppercase text-muted-foreground-strong">{item.brand ?? "Kit"}</p>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-subtitle text-foreground">
            <Link href={item.href}>{item.name}</Link>
          </h3>
          <PriceTag priceCents={item.priceCents} listPriceCents={item.listPriceCents} className="shrink-0" />
        </div>
        <p className="mt-0.5 text-body-sm text-muted-foreground-strong">
          {item.quantityLabel}
          {item.variantCount > 1 ? <span> · {item.variantCount} presentaciones</span> : null}
        </p>
        {item.summary && !compact ? <p className="mt-2 line-clamp-2 text-body-sm text-foreground/80">{item.summary}</p> : null}
      </div>
    </article>
  );
}

export { ShelfCard };
