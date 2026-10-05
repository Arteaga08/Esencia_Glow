import Link from "next/link";
import type { ReactNode } from "react";
import type { AccountData } from "../_kit/fixture";
import { LinkTabs } from "../_kit/link-tabs";
import { ACCOUNT_NAV } from "../_kit/nav";
import { previewHref } from "../_kit/preview-state";
import { LABEL, TEXT_LINK } from "../_kit/styles";
import type { AccountView } from "../_kit/types";

interface AccountShellBProps {
  view: AccountView;
  base: string;
  data: AccountData;
  children: ReactNode;
}

/**
 * Propuesta B, Mi cuenta: encabezado de bitácora (nombre y correo en voz mono)
 * y pestañas horizontales con un resumen de apertura. El contenido va en
 * renglones separados por reglas, sin tarjetas.
 */
function AccountShellB({ view, base, data, children }: AccountShellBProps) {
  const tabs = [
    { href: previewHref(base, "inicio"), label: "Resumen", active: view === "inicio" },
    ...ACCOUNT_NAV.map((item) => ({ href: previewHref(base, item.view), label: item.label, active: item.view === view })),
  ];
  const current = ACCOUNT_NAV.find((item) => item.view === view);

  return (
    <main className="pt-16 xl:pt-20">
      <div className="mx-auto max-w-3xl px-4 pt-12 pb-40 md:px-8 md:pt-16">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className={LABEL}>Mi cuenta</p>
            <h1 className="mt-1 type-shop-section text-foreground">
              {data.user.firstName} {data.user.lastName.split(" ")[0]}
            </h1>
          </div>
          <Link href={previewHref(base, "ingresar")} className={TEXT_LINK}>
            Cerrar sesión
          </Link>
        </header>
        <LinkTabs items={tabs} ariaLabel="Secciones de Mi cuenta" />
        <div className="pt-8">
          {current ? <h2 className="sr-only">{current.title}</h2> : null}
          {children}
        </div>
      </div>
    </main>
  );
}

export { AccountShellB };
