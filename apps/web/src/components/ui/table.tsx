import { cloneElement, type ReactElement, type ReactNode } from "react";

interface TableColumn<T> {
  /** Encabezado — texto plano, la tipografía Etiqueta la pinta el propio Table. */
  header: string;
  /** Alineación a la derecha para columnas numéricas (DESIGN.md §5, Table). */
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  /** Ancho fijo opcional — útil para la columna del handle de arrastre. */
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /**
   * Punto de extensión para filas arrastrables: si viene, Table le delega la
   * fila completa (recibe las celdas ya armadas, arma su propio `<tr>` con
   * el `ref`/listeners de `useSortable`) y solo le inyecta la `key`. Sin
   * esto, Table no sabe nada de drag-and-drop — esa lógica vive en quien la
   * usa (ver categorías, donde @dnd-kit envuelve cada fila).
   */
  renderRow?: (row: T, cells: ReactNode[]) => ReactElement;
}

/**
 * Debuta en Categorías (DESIGN.md §5): encabezado `surface` + Etiqueta PT
 * Mono mayúsculas + borde inferior `border-strong`; fila con borde `border`
 * (el susurro), hover `muted` al 50%; toda cifra en `tabular-nums`. No
 * incluye selección de filas ni orden por columna — esta sección no los
 * necesita (el orden es manual, por arrastre, no por columna).
 */
function Table<T>({ columns, rows, rowKey, renderRow }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-body-sm">
        <thead>
          <tr className="border-b border-border-strong bg-muted/40">
            {columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={
                  "px-4 py-3 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong " +
                  (column.align === "right" ? "text-right " : "text-left ") +
                  (column.className ?? "")
                }
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cells = columns.map((column, index) => (
              <td
                key={index}
                className={
                  "px-4 py-3 text-foreground " +
                  (column.align === "right" ? "text-right font-mono tabular-nums " : "text-left ") +
                  (column.className ?? "")
                }
              >
                {column.render(row)}
              </td>
            ));

            const tr = renderRow ? (
              renderRow(row, cells)
            ) : (
              <tr className="border-b border-border last:border-b-0 hover:bg-muted/50">{cells}</tr>
            );
            return cloneElement(tr, { key: rowKey(row) });
          })}
        </tbody>
      </table>
    </div>
  );
}

export type { TableColumn, TableProps };
export { Table };
