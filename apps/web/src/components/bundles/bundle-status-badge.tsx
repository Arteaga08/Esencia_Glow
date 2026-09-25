import { Archive } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import type { AdminBundleStatus } from "@/lib/types/admin-catalog";

/**
 * "Archivado" reusa el mismo sello con ícono que `ProductCard` — nunca un
 * badge rojo, archivar no es un estado de fallo (ver PRODUCT.md).
 */
function BundleStatusBadge({ status }: { status: AdminBundleStatus }) {
  if (status === "archived") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
        <Archive size={12} aria-hidden="true" />
        Archivado
      </span>
    );
  }
  if (status === "active") {
    return <Badge color="success">Activo</Badge>;
  }
  return <Badge color="neutral">Borrador</Badge>;
}

export { BundleStatusBadge };
