import { EditionStatus } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";

/** Borrador = neutro (todavía se arma), Publicada = positivo (lista para el
 * cobro del ciclo). */
function EditionStatusBadge({ status }: { status: EditionStatus }) {
  return status === EditionStatus.PUBLISHED ? (
    <Badge color="success">Publicada</Badge>
  ) : (
    <Badge color="neutral">Borrador</Badge>
  );
}

export { EditionStatusBadge };
