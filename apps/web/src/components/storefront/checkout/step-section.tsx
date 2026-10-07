import type { ReactNode } from "react";
import { Check } from "@phosphor-icons/react/ssr";
import type { StepStatus } from "@/lib/storefront/checkout/checkout-machine";

interface StepSectionProps {
  number: number;
  title: string;
  status: StepStatus;
  /** Texto de lo que falta para habilitar este paso (solo `upcoming`). */
  waiting: string;
  /** En móvil la pantalla actual no es de este paso: no se pinta (en escritorio siempre se ve). */
  mobileHidden?: boolean;
  children: ReactNode;
}

const MARKER: Record<StepStatus, string> = {
  done: "border-secondary bg-secondary text-secondary-foreground",
  active: "border-primary-action bg-primary text-foreground",
  upcoming: "border-border-strong text-muted-foreground-strong",
};

/**
 * Sección de la página única: las tres siempre visibles, apiladas. La activa
 * lleva su formulario, la terminada se queda con su resumen (sin esconderlo) y
 * la que falta se ve apagada con lo que necesita para habilitarse.
 */
function StepSection({ number, title, status, waiting, mobileHidden = false, children }: StepSectionProps) {
  return (
    <section aria-labelledby={`step-${number}`} className={`border-t border-border-strong py-8 max-lg:border-t-0 max-lg:py-4 ${mobileHidden ? "max-lg:hidden" : ""}`}>
      {/* En móvil el título lo pone `MobileStepHeader`: aquí solo se queda para lectores de pantalla. */}
      <div className="flex items-center gap-3 max-lg:sr-only">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-md border font-mono text-data ${MARKER[status]}`}>
          {status === "done" ? <Check size={16} weight="bold" aria-label="Paso completo" /> : number}
        </span>
        <h2 id={`step-${number}`} tabIndex={-1} className={`scroll-mt-24 text-section-title outline-none ${status === "upcoming" ? "text-muted-foreground-strong" : "text-foreground"}`}>
          {title}
        </h2>
      </div>
      <div className="mt-6 max-lg:mt-0 sm:pl-11">{status === "upcoming" ? <p className="text-body-sm text-muted-foreground-strong">{waiting}</p> : children}</div>
    </section>
  );
}

export { StepSection };
