import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/storefront/catalog/breadcrumb";

interface LegalPageProps {
  title: string;
  /** Línea bajo el título: la fecha de actualización o un resumen corto. */
  subtitle: string;
  children: ReactNode;
}

/**
 * Estructura de las páginas legales y de ayuda: la placa rosa de los listados
 * (migas, título, subtítulo) y, debajo, el texto en una columna de lectura.
 */
function LegalPage({ title, subtitle, children }: LegalPageProps) {
  return (
    <main className="pt-16 xl:pt-20">
      <section className="bg-blush">
        <div className="mx-auto max-w-shell px-4 py-10 md:px-8 md:py-14 xl:px-12">
          <Breadcrumb trail={[{ name: title }]} />
          <h1 className="mt-4 type-shop-marquee text-foreground">{title}</h1>
          <p className="mt-3 max-w-xl text-body text-foreground/85">{subtitle}</p>
        </div>
      </section>
      <div className="mx-auto max-w-shell px-4 py-12 pb-20 md:px-8 md:py-16 xl:px-12">
        <article className="flex max-w-[72ch] flex-col gap-8">{children}</article>
      </div>
    </main>
  );
}

export { LegalPage };
