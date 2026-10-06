import type { AccountFetch } from "@/lib/storefront/account-server";
import { SessionGate } from "../session-gate";
import { LoadError } from "./load-error";

type FailedFetch = Exclude<AccountFetch<unknown, unknown>["status"], "ok">;

/**
 * Lo que pinta una página de Mi cuenta cuando su lectura no salió bien: con la
 * sesión vencida, el refresco silencioso (`SessionGate`) en vez de un "no pudimos
 * cargar" que no se arregla reintentando; con cualquier otro fallo, `LoadError`.
 */
function LoadFailure({ status, what }: { status: FailedFetch; what: string }) {
  if (status === "unauthorized") return <SessionGate bare />;
  return <LoadError what={what} />;
}

export { LoadFailure };
