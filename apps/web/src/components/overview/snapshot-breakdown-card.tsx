import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBreakdownBars, type BreakdownRow } from "./status-breakdown-bars";

interface SnapshotBreakdownCardProps {
  title: string;
  description: string;
  rows: BreakdownRow[] | null;
}

/** Tarjeta de foto (Pedidos/Envíos/Inventario/Suscripciones): reparto por
 * renglón, cada uno lleva a su sección — ya filtrada cuando esa sección
 * sabe leer el filtro de la URL (Milestone 2.9, decisión de Manuel de
 * ampliar 4 páginas para que sepan). Nunca la fila de 4 KPI idénticos que
 * `PRODUCT.md`/`DESIGN.md` rechazan. */
function SnapshotBreakdownCard({ title, description, rows }: SnapshotBreakdownCardProps) {
  return (
    <Card>
      <h2 className="text-heading-sm text-foreground">{title}</h2>
      <p className="mb-4 text-body-sm text-muted-foreground-strong">{description}</p>
      {rows === null ? <Skeleton className="h-24 w-full" /> : <StatusBreakdownBars rows={rows} />}
    </Card>
  );
}

export { SnapshotBreakdownCard };
