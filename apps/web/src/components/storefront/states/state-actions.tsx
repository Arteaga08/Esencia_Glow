import Link from "next/link";
import { BackButton } from "./back-button";
import { STATE_PRIMARY_BUTTON, STATE_SECONDARY_BUTTON } from "./state-buttons";
import type { StateKind } from "./state-copy";

/**
 * Acciones de una página de estado. Error: "Reintentar" (si el framework
 * entrega `retry`) e "Ir al inicio". 404: "Ir al inicio" y "Volver atrás".
 */
function StateActions({ kind, retry }: { kind: StateKind; retry?: () => void }) {
  const canRetry = kind === "error" && retry !== undefined;

  return (
    <div className="flex flex-wrap gap-3">
      {canRetry ? (
        <button type="button" onClick={retry} className={STATE_PRIMARY_BUTTON}>
          Reintentar
        </button>
      ) : null}
      <Link href="/" className={canRetry ? STATE_SECONDARY_BUTTON : STATE_PRIMARY_BUTTON}>
        Ir al inicio
      </Link>
      {kind === "not-found" ? <BackButton className={STATE_SECONDARY_BUTTON} /> : null}
    </div>
  );
}

export { StateActions };
