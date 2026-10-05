import Link from "next/link";
import type { ReactNode } from "react";
import { CaretLeft } from "@phosphor-icons/react/ssr";
import { LinkTabs } from "../_kit/link-tabs";
import { previewHref } from "../_kit/preview-state";
import { SURFACE_VARS, TEXT_LINK } from "../_kit/styles";
import type { AuthView } from "../_kit/types";

interface AuthShellCProps {
  view: AuthView;
  base: string;
  children: ReactNode;
}

/**
 * Propuesta C, acceso: una tarjeta blanca sobre el rosa suave de la marca
 * (el mismo `blush` del header con scroll, así que la cabecera se funde). Entrar y
 * crear cuenta son dos pestañas de la misma tarjeta, como en el paso de cuenta
 * del checkout; las demás pantallas solo traen un enlace de regreso.
 */
function AuthShellC({ view, base, children }: AuthShellCProps) {
  const isEntry = view === "ingresar" || view === "crear";

  return (
    <main className="min-h-[100dvh] bg-blush pt-16 xl:pt-20">
      <div className="mx-auto w-full max-w-md px-4 pt-8 pb-40 md:pt-16">
        <div style={SURFACE_VARS} className="rounded-md border border-border-strong bg-surface p-6 md:p-8">
          {isEntry ? (
            <div className="mb-7">
              <LinkTabs
                ariaLabel="Entrar o crear cuenta"
                items={[
                  { href: previewHref(base, "ingresar"), label: "Ya tengo cuenta", active: view === "ingresar" },
                  { href: previewHref(base, "crear"), label: "Soy nueva", active: view === "crear" },
                ]}
              />
            </div>
          ) : (
            <Link href={previewHref(base, "ingresar")} className={`${TEXT_LINK} -ml-1 mb-4 gap-1`}>
              <CaretLeft size={16} aria-hidden="true" />
              Volver a ingresar
            </Link>
          )}
          {children}
        </div>
      </div>
    </main>
  );
}

export { AuthShellC };
