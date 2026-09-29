import { Badge } from "@/components/ui/badge";

/** Activo = neutro a propósito: es el estado normal y no debe competir con
 * nada. Solo lo inusual (desactivado) gana color. */
function PlanStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge color="neutral">Activo</Badge>
  ) : (
    <Badge color="danger">Desactivado</Badge>
  );
}

export { PlanStatusBadge };
