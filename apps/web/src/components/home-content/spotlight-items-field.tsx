"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical, X } from "@phosphor-icons/react";
import { HOME_CONTENT_LIMITS, type AdminHomeSpotlightItem } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/field-error";
import { BundlePicker } from "@/components/bundles/bundle-picker";
import { ProductPicker } from "@/components/bundles/product-picker";
import type { AdminBundle, AdminProduct } from "@/lib/types/admin-catalog";
import type { SpotlightItemKind } from "./spotlight-form-value";

const MAX_ITEMS = HOME_CONTENT_LIMITS.maxSpotlightItems;

interface SpotlightItemsFieldProps {
  kind: SpotlightItemKind;
  itemIds: string[];
  summaries: Record<string, AdminHomeSpotlightItem>;
  /** `true` mientras llegan los nombres de lo ya guardado. */
  loading: boolean;
  onChange: (itemIds: string[], summaries: Record<string, AdminHomeSpotlightItem>) => void;
  error?: string;
}

const COPY: Record<SpotlightItemKind, { noun: string; pickerLabel: string; empty: string }> = {
  product: {
    noun: "producto",
    pickerLabel: "Agregar producto",
    empty: "Sin productos elegidos: el home muestra automáticamente las novedades más recientes.",
  },
  bundle: {
    noun: "kit",
    pickerLabel: "Agregar kit",
    empty: "Sin kits elegidos: el home muestra automáticamente los kits publicados más recientes.",
  },
};

function summaryOfProduct(product: AdminProduct): AdminHomeSpotlightItem {
  const imageUrl = product.images[0]?.url;
  return { id: product.id, name: product.name, ...(imageUrl ? { imageUrl } : {}), isPublished: product.status === "active" };
}

function summaryOfBundle(bundle: AdminBundle): AdminHomeSpotlightItem {
  const imageUrl = bundle.images[0]?.url;
  return { id: bundle.id, name: bundle.name, ...(imageUrl ? { imageUrl } : {}), isPublished: bundle.status === "active" };
}

interface ItemRowProps {
  id: string;
  position: number;
  summary: AdminHomeSpotlightItem | undefined;
  loading: boolean;
  onRemove: () => void;
}

function ItemRow({ id, position, summary, loading, onRemove }: ItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const name = summary?.name ?? (loading ? "Cargando…" : "Ya no existe");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="flex items-center gap-3 rounded-lg border border-border-strong bg-surface p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${name}`}
        className="cursor-grab rounded-sm p-1 text-muted-foreground-strong hover:bg-muted active:cursor-grabbing"
      >
        <DotsSixVertical size={20} aria-hidden="true" />
      </button>
      <span className="w-5 shrink-0 text-center font-mono text-label text-muted-foreground-strong">{position}</span>
      {summary?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={summary.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-label text-muted-foreground">
          Sin foto
        </div>
      )}
      <p className="min-w-0 flex-1 truncate text-body text-foreground">{name}</p>
      {summary && !summary.isPublished ? <Badge color="warning">No publicado</Badge> : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${name}`}
        className="cursor-pointer rounded-sm p-1.5 text-muted-foreground-strong hover:bg-muted hover:text-foreground"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Tarjetas de Novedades o Kits: lista ordenable (arrastrar o teclado) y un
 * buscador para agregar, hasta `maxSpotlightItems`. El orden de la lista es el
 * orden del home. Un elemento "No publicado" se conserva pero el home lo omite.
 */
function SpotlightItemsField({ kind, itemIds, summaries, loading, onChange, error }: SpotlightItemsFieldProps) {
  const copy = COPY[kind];
  const full = itemIds.length >= MAX_ITEMS;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = itemIds.indexOf(String(active.id));
    const to = itemIds.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onChange(arrayMove(itemIds, from, to), summaries);
  }

  function add(summary: AdminHomeSpotlightItem) {
    if (full || itemIds.includes(summary.id)) return;
    onChange([...itemIds, summary.id], { ...summaries, [summary.id]: summary });
  }

  function remove(id: string) {
    onChange(
      itemIds.filter((current) => current !== id),
      summaries,
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Tarjetas del bloque</p>
        <p className="text-body-sm text-muted-foreground-strong">
          {itemIds.length} de {MAX_ITEMS}
        </p>
      </div>

      {itemIds.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong p-3 text-body-sm text-muted-foreground-strong">
          {copy.empty}
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {itemIds.map((id, index) => (
                <ItemRow
                  key={id}
                  id={id}
                  position={index + 1}
                  summary={summaries[id]}
                  loading={loading}
                  onRemove={() => remove(id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {full ? (
        <p className="text-body-sm text-muted-foreground-strong">
          Ya elegiste {MAX_ITEMS}. Quita uno para agregar otro {copy.noun}.
        </p>
      ) : kind === "product" ? (
        <ProductPicker
          value={null}
          selectedProduct={null}
          onChange={(product) => add(summaryOfProduct(product))}
          channel="store"
          label={copy.pickerLabel}
          onlyActive
        />
      ) : (
        <BundlePicker onChange={(bundle) => add(summaryOfBundle(bundle))} label={copy.pickerLabel} onlyActive />
      )}
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}

export { SpotlightItemsField };
