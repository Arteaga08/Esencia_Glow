"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CaretRight, DotsSixVertical, PencilSimple, Trash } from "@phosphor-icons/react";
import { Switch } from "@/components/ui/switch";
import type { AdminCategory } from "@/lib/types/admin-catalog";

interface RootCategoryRowProps {
  category: AdminCategory;
  onEnter: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisible: (next: boolean) => void;
  togglingVisible: boolean;
}

/**
 * Propuesta A elegida por Manuel (Milestone 2.2.2, Fase 2 — "Fila ancha"):
 * fila de ancho completo, máxima densidad. Casi toda la fila es un botón que
 * entra a las subcategorías — el handle de arrastre, el switch y las
 * acciones de editar/borrar son las únicas zonas con su propio click.
 */
function RootCategoryRow({
  category,
  onEnter,
  onEdit,
  onDelete,
  onToggleVisible,
  togglingVisible,
}: RootCategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const childrenCount = category.childrenCount ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 rounded-lg border border-border-strong bg-surface p-3 transition-colors hover:border-foreground/40"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${category.name}`}
        className="cursor-grab rounded-sm p-1 text-muted-foreground-strong hover:bg-muted active:cursor-grabbing"
      >
        <DotsSixVertical size={20} aria-hidden="true" />
      </button>

      {category.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={category.image.url}
          alt={category.image.alt ?? ""}
          className="h-14 w-14 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-body-sm text-muted-foreground">
          Sin foto
        </div>
      )}

      <button type="button" onClick={onEnter} className="flex flex-1 items-center justify-between text-left">
        <div>
          <p className="text-subtitle font-medium text-foreground">{category.name}</p>
          <p className="text-body-sm text-muted-foreground-strong">
            {childrenCount} {childrenCount === 1 ? "subcategoría" : "subcategorías"}
          </p>
        </div>
        <CaretRight size={18} className="text-muted-foreground" aria-hidden="true" />
      </button>

      <Switch
        checked={category.isActive}
        onChange={onToggleVisible}
        label={`Mostrar ${category.name}`}
        disabled={togglingVisible}
      />

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar ${category.name}`}
        className="rounded-sm p-1.5 text-muted-foreground-strong hover:bg-muted hover:text-foreground"
      >
        <PencilSimple size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Borrar ${category.name}`}
        title="Borra la categoría (falla si tiene subcategorías o productos)"
        className="rounded-sm p-1.5 text-destructive-action hover:bg-destructive/30"
      >
        <Trash size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export { RootCategoryRow };
export type { RootCategoryRowProps };
