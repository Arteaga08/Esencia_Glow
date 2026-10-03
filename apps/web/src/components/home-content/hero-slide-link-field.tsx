"use client";

import { useEffect, useState } from "react";
import type { PaginationMeta } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import type { AdminProduct } from "@/lib/types/admin-catalog";
import { ProductPicker } from "@/components/bundles/product-picker";
import { FieldError } from "@/components/ui/field-error";

const PRODUCT_HREF_PREFIX = "/producto/";

interface HeroSlideLinkFieldProps {
  href: string;
  error?: string;
  /** Texto de ayuda bajo el buscador; por defecto, el del slide del hero. */
  hint?: string;
  onChange: (href: string) => void;
}

function productHref(product: AdminProduct): string {
  return `${PRODUCT_HREF_PREFIX}${product.slug}`;
}

function slugFromHref(href: string): string | null {
  return href.startsWith(PRODUCT_HREF_PREFIX) ? href.slice(PRODUCT_HREF_PREFIX.length) || null : null;
}

/**
 * A dónde lleva el slide: la dueña elige un producto con el mismo buscador de
 * Paquetes (máximo 6 resultados) en vez de escribir una ruta a mano. Se sigue
 * guardando como `ctaHref` (`/producto/<slug>`), así que el API no cambia.
 *
 * Al abrir un slide ya guardado se busca su producto por slug para mostrar el
 * nombre; si el enlace no es de producto (uno escrito antes de este cambio) se
 * muestra tal cual hasta que elija un producto que lo reemplace.
 */
function HeroSlideLinkField({
  href,
  error,
  hint = "Al tocar el slide, la clienta llega a este producto.",
  onChange,
}: HeroSlideLinkFieldProps) {
  const [selected, setSelected] = useState<AdminProduct | null>(null);
  const slug = slugFromHref(href);
  const resolved = selected && productHref(selected) === href ? selected : null;

  useEffect(() => {
    if (!slug || resolved) return;
    let cancelled = false;
    apiRequest<AdminProduct[], PaginationMeta>("/api/v1/admin/products", {
      authenticated: true,
      query: { search: slug, limit: 6 },
    })
      .then((response) => {
        if (cancelled) return;
        setSelected(response.data.find((product) => product.slug === slug) ?? null);
      })
      .catch(() => {
        // Sin nombre resuelto se muestra la ruta guardada; no bloquea la edición.
      });
    return () => {
      cancelled = true;
    };
  }, [slug, resolved]);

  function handlePick(product: AdminProduct) {
    setSelected(product);
    onChange(productHref(product));
  }

  const legacyHref = href && !resolved ? href : null;

  return (
    <div className="flex flex-col gap-1.5">
      <ProductPicker
        value={resolved?.id ?? null}
        selectedProduct={resolved}
        onChange={handlePick}
        channel="store"
        label="Producto al que lleva"
        onlyActive
      />
      {error ? (
        <FieldError message={error} />
      ) : (
        <p className="text-body-sm text-muted-foreground">
          {legacyHref
            ? `Enlace actual: ${legacyHref}. Elige un producto para reemplazarlo.`
            : hint}
        </p>
      )}
    </div>
  );
}

export { HeroSlideLinkField };
