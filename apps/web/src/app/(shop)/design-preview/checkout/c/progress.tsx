import Link from "next/link";
import { FOCUS } from "../_kit/cta-styles";
import { previewHref } from "../_kit/preview-state";

type ProgressView = "cuenta" | "envio" | "pago" | "listo";

const STEPS: Array<{ view: ProgressView; label: string }> = [
  { view: "cuenta", label: "Cuenta" },
  { view: "envio", label: "Envío" },
  { view: "pago", label: "Pago" },
];

/**
 * Barra de tres pasos: un segmento por paso, lleno hasta el actual. Los pasos
 * ya hechos son enlaces para volver; el actual lo anuncia `aria-current`.
 * Con `listo` los tres quedan llenos.
 */
function Progress({ current, base }: { current: ProgressView; base: string }) {
  const currentIndex = current === "listo" ? STEPS.length : STEPS.findIndex((step) => step.view === current);

  return (
    <nav aria-label="Pasos del pago">
      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((step, index) => {
          const reached = index <= currentIndex;
          const done = index < currentIndex;
          const content = (
            <>
              <span aria-hidden="true" className={`block h-1 rounded-sm ${reached ? "bg-primary-action" : "bg-border-strong"}`} />
              <span className={`mt-2 block font-mono text-label uppercase ${reached ? "text-foreground" : "text-muted-foreground-strong"}`}>{step.label}</span>
            </>
          );
          return (
            <li key={step.view} aria-current={index === currentIndex ? "step" : undefined}>
              {done && current !== "listo" ? (
                <Link href={previewHref(base, step.view)} className={`block rounded-sm ${FOCUS}`}>
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Progress };
export type { ProgressView };
