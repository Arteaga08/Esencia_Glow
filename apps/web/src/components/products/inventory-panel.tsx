"use client";

import { useEffect, useState } from "react";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface VariantInventoryRow {
  variantId: string;
  sku: string;
  name: string;
  onHand: number | null;
  reserved: number | null;
  available: number | null;
  status: "out" | "low" | "ok" | "untracked";
}

interface InventoryDetail {
  productId: string;
  variants: VariantInventoryRow[];
}

const STATUS_BADGE: Record<VariantInventoryRow["status"], { color: "danger" | "warning" | "success" | "neutral"; label: string }> = {
  out: { color: "danger", label: "Agotado" },
  low: { color: "warning", label: "Stock bajo" },
  ok: { color: "success", label: "OK" },
  untracked: { color: "neutral", label: "Sin registro" },
};

/**
 * Existencias por variante, dentro del editor de producto (Milestone 2.2.1).
 * No requiere backend nuevo: `GET/PATCH /api/v1/admin/inventory/...`
 * (Milestone 1.4) ya existen. La primera vez que se captura stock de una
 * variante sin fila, esta pantalla la crea al vuelo (`POST /admin/inventory`)
 * — "sin registro" no es lo mismo que "agotado" (ver product-variant.service.ts).
 */
function InventoryPanel({ productId }: { productId: string }) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<InventoryDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<InventoryDetail>(`/api/v1/admin/inventory/products/${productId}`, { authenticated: true })
      .then((response) => {
        if (cancelled) return;
        setDetail(response.data);
      })
      .catch(() => {
        // El editor sigue funcionando sin este bloque si falla — no es el
        // dato principal de la pantalla.
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function applyOnHand(row: VariantInventoryRow) {
    const draftValue = drafts[row.variantId];
    if (draftValue === undefined || draftValue.trim() === "") return;
    const onHand = Number(draftValue);
    if (!Number.isInteger(onHand) || onHand < 0) {
      toast({ variant: "error", title: "Cantidad inválida", description: "Debe ser un entero mayor o igual a 0." });
      return;
    }

    setSavingVariantId(row.variantId);
    try {
      if (row.onHand === null) {
        await apiRequest("/api/v1/admin/inventory", {
          method: "POST",
          authenticated: true,
          body: { productId, variantId: row.variantId, onHand },
        });
      } else {
        await apiRequest(`/api/v1/admin/inventory/${row.variantId}/stock`, {
          method: "PATCH",
          authenticated: true,
          body: { onHand },
        });
      }
      const refreshed = await apiRequest<InventoryDetail>(
        `/api/v1/admin/inventory/products/${productId}`,
        { authenticated: true },
      );
      setDetail(refreshed.data);
      setDrafts((current) => ({ ...current, [row.variantId]: "" }));
      toast({ variant: "success", title: "Existencia actualizada", description: row.sku });
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo actualizar la existencia",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSavingVariantId(null);
    }
  }

  if (!detail) return null;

  return (
    <div>
      <p className="mb-2 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
        Existencias
      </p>
      <div className="flex flex-col gap-2">
        {detail.variants.map((row) => (
          <div
            key={row.variantId}
            className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-medium text-foreground">{row.name}</p>
              <p className="font-mono text-body-sm tabular-nums text-muted-foreground-strong">{row.sku}</p>
            </div>
            <Badge color={STATUS_BADGE[row.status].color}>{STATUS_BADGE[row.status].label}</Badge>
            <div className="font-mono text-body-sm tabular-nums text-muted-foreground-strong">
              disponible: {row.available ?? "—"} · reservado: {row.reserved ?? "—"}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-28">
                <Input
                  label="Recuento"
                  type="number"
                  placeholder={row.onHand !== null ? String(row.onHand) : "0"}
                  value={drafts[row.variantId] ?? ""}
                  onChange={(e) => setDrafts((current) => ({ ...current, [row.variantId]: e.target.value }))}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => applyOnHand(row)}
                loading={savingVariantId === row.variantId}
              >
                Aplicar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { InventoryPanel };
