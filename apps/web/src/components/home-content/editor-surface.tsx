import type { CSSProperties, ReactNode } from "react";
import { Card } from "@/components/ui/card";

/**
 * Superficie de un editor del home. Suelto (`embedded` falso) pinta su propia
 * `Card`; embebido, lo envuelve un contenedor (acordeón, índice o mapa) que ya
 * pone el borde, el título y el estado de guardado. Aun embebido declara
 * `--surface-bg` (DESIGN.md §5): la muesca del `<label>` de Input tapa el
 * borde con el fondo real de su ancestro.
 */
function EditorSurface({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  if (!embedded) return <Card>{children}</Card>;
  return (
    <div style={{ "--surface-bg": "var(--color-surface)" } as CSSProperties} className="bg-surface">
      {children}
    </div>
  );
}

export { EditorSurface };
