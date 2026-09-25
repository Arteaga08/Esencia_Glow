"use client";

import { useEffect, useState } from "react";
import { Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { apiRequest } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoneyMXN } from "@/lib/format-money";
import type { AdminBundleItem, AdminProduct } from "@/lib/types/admin-catalog";
import { ProductPicker } from "./product-picker";

interface EnrichedItem extends AdminBundleItem {
  productName: string;
  variantName: string;
  unitPrice: number;
}

interface BundleItemEditorProps {
  items: AdminBundleItem[];
  onChange: (items: AdminBundleItem[]) => void;
  /** Suma de `unitPrice × quantity` de los componentes ya resueltos — el
   * padre la usa solo como referencia junto al precio manual del paquete
   * (ver bundle-base-fields.tsx), nunca para calcular nada que se guarde. */
  onSumChange?: (sum: number) => void;
  error?: string;
}

function enrich(item: AdminBundleItem, product?: AdminProduct): EnrichedItem {
  const variant = product?.variants.find((v) => v.id === item.variantId);
  return {
    ...item,
    productName: product?.name ?? "Producto no disponible",
    variantName: variant?.name ?? "—",
    unitPrice: variant?.price ?? 0,
  };
}

/**
 * "Componentes del paquete" — la parte sin precedente en el panel (ver el
 * plan de Milestone 2.2.3): elegir un producto ya existente, su variante y
 * la cantidad. `items` viaja sin enriquecer entre panel y API
 * (bundle-dto.ts) — este componente resuelve nombre/precio del lado del
 * cliente, una vez por producto único, contra `GET /admin/products/:id`.
 */
function BundleItemEditor({ items, onChange, onSumChange, error }: BundleItemEditorProps) {
  const [enriched, setEnriched] = useState<EnrichedItem[]>([]);
  const [resolving, setResolving] = useState(items.length > 0);

  useEffect(() => {
    onSumChange?.(enriched.reduce((total, item) => total + item.unitPrice * item.quantity, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onSumChange` es un callback del padre, no un dato que deba reprogramar el efecto
  }, [enriched]);

  // Resuelve nombre/precio de los items que YA vienen del servidor (edición
  // de un paquete existente) — solo corre cuando cambia el conjunto de ids,
  // nunca cuando el propio componente agrega/quita una línea (esos casos ya
  // traen su producto resuelto de `ProductPicker`, no hace falta refetch).
  useEffect(() => {
    const known = new Set(enriched.map((item) => item.variantId));
    const incoming = new Set(items.map((item) => item.variantId));
    const sameSet = known.size === incoming.size && [...known].every((id) => incoming.has(id));
    if (sameSet) return;

    // Todo setState vive dentro del `.then()`, nunca directo en el cuerpo
    // del efecto (react-hooks/set-state-in-effect) — `Promise.all([])`
    // resuelve igual en un microtask cuando `items` está vacío, así que ni
    // siquiera hace falta un branch síncrono aparte para ese caso.
    let cancelled = false;
    const uniqueProductIds = [...new Set(items.map((item) => item.productId))];
    Promise.all(
      uniqueProductIds.map((id) =>
        apiRequest<AdminProduct>(`/api/v1/admin/products/${id}`, { authenticated: true })
          .then((res) => res.data)
          .catch(() => null),
      ),
    ).then((products) => {
      if (cancelled) return;
      const byId = new Map(products.filter((p): p is AdminProduct => p !== null).map((p) => [p.id, p]));
      setEnriched(items.map((item) => enrich(item, byId.get(item.productId))));
      setResolving(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- comparación por contenido arriba, no por referencia
  }, [items]);

  const [pickedProduct, setPickedProduct] = useState<AdminProduct | null>(null);
  const [pickedVariantId, setPickedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");

  const duplicateVariant =
    pickedVariantId != null && items.some((item) => item.variantId === pickedVariantId);

  function addComponent() {
    if (!pickedProduct || !pickedVariantId || duplicateVariant) return;
    const qty = Math.max(1, Number(quantity) || 1);
    const nextItem: AdminBundleItem = { productId: pickedProduct.id, variantId: pickedVariantId, quantity: qty };
    setEnriched((current) => [...current, enrich(nextItem, pickedProduct)]);
    onChange([...items, nextItem]);
    setPickedProduct(null);
    setPickedVariantId(null);
    setQuantity("1");
  }

  function removeComponent(variantId: string) {
    setEnriched((current) => current.filter((item) => item.variantId !== variantId));
    onChange(items.filter((item) => item.variantId !== variantId));
  }

  return (
    <Card>
      <p className="mb-4 text-section-title text-foreground">Componentes del paquete</p>

      {resolving ? (
        <p className="text-body-sm text-muted-foreground">Cargando componentes…</p>
      ) : enriched.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          Sin componentes todavía — agrega al menos uno abajo.
        </p>
      ) : (
        <div className="mb-4 flex flex-col gap-2">
          {enriched.map((item) => (
            <div
              key={item.variantId}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-body text-foreground">{item.productName}</p>
                <p className="text-body-sm text-muted-foreground-strong">{item.variantName}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className="font-mono text-data tabular-nums text-muted-foreground-strong">
                  {item.quantity}× {formatMoneyMXN(item.unitPrice)}
                </span>
                <button
                  type="button"
                  onClick={() => removeComponent(item.variantId)}
                  aria-label={`Quitar ${item.productName}`}
                  className="rounded-sm p-1.5 text-destructive-action hover:bg-destructive/30"
                >
                  <Trash size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? <p className="mb-3 text-body-sm text-destructive-action">{error}</p> : null}

      <div className="rounded-md border border-dashed border-border-strong p-3">
        <p className="mb-3 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
          Agregar componente
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <ProductPicker
            value={pickedProduct?.id ?? null}
            selectedProduct={pickedProduct}
            onChange={(product) => {
              setPickedProduct(product);
              setPickedVariantId(product.variants.length === 1 ? (product.variants[0]?.id ?? null) : null);
            }}
          />
          <Select
            label="Variante"
            value={pickedVariantId}
            onChange={setPickedVariantId}
            placeholder={pickedProduct ? "Elige una variante" : "Elige un producto primero"}
            disabled={!pickedProduct}
            options={(pickedProduct?.variants ?? []).map((variant) => ({
              value: variant.id,
              label: `${variant.name} · ${formatMoneyMXN(variant.price)}`,
            }))}
          />
          <Input
            label="Cantidad"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-24"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={addComponent}
            disabled={!pickedProduct || !pickedVariantId || duplicateVariant}
            className="mt-2 self-start"
          >
            <Plus size={16} weight="bold" aria-hidden="true" />
            Agregar
          </Button>
        </div>
        {duplicateVariant ? (
          <p className="mt-2 flex items-center gap-1.5 text-body-sm text-destructive-action">
            <WarningCircle size={16} aria-hidden="true" />
            Esa variante ya está en el paquete — no puedes repetirla.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export { BundleItemEditor };
