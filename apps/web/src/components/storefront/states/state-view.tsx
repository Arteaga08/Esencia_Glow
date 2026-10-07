import type { ReactNode } from "react";
import { StateActions } from "./state-actions";
import { STATE_COPY, type StateKind } from "./state-copy";
import { StateReference } from "./state-reference";

interface StateViewProps {
  kind: StateKind;
  retry?: () => void;
  digest?: string;
  /** Contenido bajo la banda: en el 404, el estante real de más vendidos. */
  extra?: ReactNode;
}

/**
 * Página de estado (404, error o "próximamente"): una banda rosa con el mensaje
 * y, debajo, la tienda sigue ahí (el estante de más vendidos en el 404). En
 * error no se agrega nada: si el API falló, no se le pide más; "próximamente"
 * tampoco lleva nada debajo. La banda deja espacio para
 * el header fijo, que es transparente arriba de la página.
 */
function StateView({ kind, retry, digest, extra }: StateViewProps) {
  const copy = STATE_COPY[kind];
  const tall = kind === "not-found" ? "" : "flex min-h-[70svh] items-end";

  return (
    <main>
      <section className={`bg-blush px-4 pt-32 pb-14 md:px-8 md:pt-44 md:pb-20 xl:px-12 ${tall}`}>
        <div className="mx-auto w-full max-w-shell">
          <h1 className="max-w-3xl text-hero text-foreground">{copy.title}</h1>
          <p className="mt-4 max-w-[48ch] text-subtitle text-foreground/80">{copy.text}</p>
          <div className="mt-8">
            <StateActions kind={kind} retry={retry} />
          </div>
          <StateReference digest={digest} className="mt-6" />
        </div>
      </section>
      {extra}
    </main>
  );
}

export { StateView };
