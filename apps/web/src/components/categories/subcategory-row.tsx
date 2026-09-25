"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical } from "@phosphor-icons/react";

interface SubcategoryRowProps {
  id: string;
  name: string;
  /** Celdas ya armadas por `Table` (ver `renderRow`) — esta fila descarta la
   * primera (el placeholder de la columna del handle) y pone la suya. */
  cells: ReactNode[];
}

/**
 * Fila arrastrable de la tabla de subcategorías — el punto de extensión
 * `renderRow` de `Table` (components/ui/table.tsx) le delega la fila
 * completa para que pueda traer el `ref`/listeners de `useSortable`, sin que
 * `Table` sepa nada de drag-and-drop.
 */
function SubcategoryRow({ id, name, cells }: SubcategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-border last:border-b-0 hover:bg-muted/50">
      <td className="px-4 py-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar ${name}`}
          className="cursor-grab rounded-sm p-1 text-muted-foreground-strong hover:bg-muted active:cursor-grabbing"
        >
          <DotsSixVertical size={16} aria-hidden="true" />
        </button>
      </td>
      {cells.slice(1)}
    </tr>
  );
}

export { SubcategoryRow };
