"use client";

import Link from "next/link";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatMoneyMXN } from "@/lib/format-money";
import type { AdminBadge, AdminBundle, AdminProduct } from "@/lib/types/admin-catalog";
import { BundleStatusBadge } from "./bundle-status-badge";

interface BundleRowProps {
  bundle: AdminBundle;
  badge?: AdminBadge;
  /** Productos ya resueltos de los items de ESTA página del listado (ver
   * bundles/page.tsx) — `items` viaja sin enriquecer desde la API
   * (bundle-dto.ts), así que el nombre de cada componente se cruza aquí. */
  productsById: Map<string, AdminProduct>;
  onTogglePublish: (next: boolean) => void;
  onArchive: () => void;
  togglingPublish: boolean;
}

/**
 * Propuesta C elegida por Manuel (Milestone 2.2.3): fila ancha al estilo de
 * `RootCategoryRow`, la composición completa siempre visible, nunca truncada.
 */
function BundleRow({ bundle, badge, productsById, onTogglePublish, onArchive, togglingPublish }: BundleRowProps) {
  const isArchived = bundle.status === "archived";
  const photo = bundle.images[0];

  return (
    <div className="flex items-start gap-4 rounded-lg border border-border-strong bg-surface p-4">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.url}
          alt={photo.alt ?? ""}
          className={"h-16 w-16 shrink-0 rounded-md object-cover " + (isArchived ? "grayscale" : "")}
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-body-sm text-muted-foreground">
          Sin foto
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-subtitle font-medium text-foreground">{bundle.name}</p>
          {badge ? <Badge color={badge.color}>{badge.text}</Badge> : null}
          <BundleStatusBadge status={bundle.status} />
        </div>
        <div className="mt-1.5 flex flex-col gap-0.5">
          {bundle.items.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">Sin componentes todavía</p>
          ) : (
            bundle.items.map((item) => {
              const product = productsById.get(item.productId);
              const variant = product?.variants.find((v) => v.id === item.variantId);
              const label = product ? `${product.name} · ${variant?.name ?? "—"}` : "Producto no disponible";
              return (
                <p
                  key={item.variantId}
                  className="font-mono text-body-sm tabular-nums text-muted-foreground-strong"
                >
                  {item.quantity}× {label}
                </p>
              );
            })
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 font-mono text-data tabular-nums text-foreground">
        {bundle.listPrice ? (
          <span className="text-body-sm text-muted-foreground-strong line-through">
            {formatMoneyMXN(bundle.listPrice)}
          </span>
        ) : null}
        <span>{formatMoneyMXN(bundle.price)}</span>
        <span
          className={
            "text-body-sm " + (bundle.stockCache === 0 ? "text-destructive-action" : "text-muted-foreground-strong")
          }
        >
          Stock: {bundle.stockCache}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2">
        {!isArchived ? (
          <Switch
            checked={bundle.status === "active"}
            onChange={onTogglePublish}
            label={`Publicar ${bundle.name}`}
            disabled={togglingPublish}
          />
        ) : null}
        <div className="flex items-center gap-1">
          <Link
            href={`/bundles/${bundle.id}`}
            aria-label={`Editar ${bundle.name}`}
            className="rounded-sm p-1.5 text-muted-foreground-strong hover:bg-muted hover:text-foreground"
          >
            <PencilSimple size={16} aria-hidden="true" />
          </Link>
          {!isArchived ? (
            <button
              type="button"
              onClick={onArchive}
              aria-label={`Archivar ${bundle.name}`}
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

export { BundleRow };
