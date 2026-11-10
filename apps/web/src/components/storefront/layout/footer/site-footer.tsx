import { getCategoryTree } from "@/lib/storefront/categories";
import { buildFooterColumns } from "@/lib/storefront/footer-links";
import { FooterAccordion } from "./footer-accordion";
import { FooterColumn } from "./footer-column";
import { FooterLogo } from "./footer-logo";
import { FooterSocial } from "./footer-social";

/**
 * Footer del storefront (bloque 10 del home). Tinta. Todo el texto alineado a
 * la izquierda: arriba la frase de marca, con el logo chico en la esquina
 * superior derecha; debajo las tres columnas en fila (desde `lg`). En móvil
 * las columnas pasan a acordeón. Fila final con créditos a la izquierda y
 * redes a la derecha, en diagonal con el logo. Sin boletín: no se va a usar.
 */
async function SiteFooter() {
  const columns = buildFooterColumns(await getCategoryTree());

  return (
    <footer className="flex flex-col overflow-x-clip bg-foreground text-background [--surface-bg:var(--color-foreground)]">
      <div className="mx-auto w-full max-w-shell px-4 pb-10 pt-10 md:px-8 lg:pb-16 lg:pt-14 xl:px-12">
        <div className="flex items-start justify-between gap-8">
          <p className="max-w-sm text-subtitle text-background/80">Skincare y lifestyle con suscripción curada.</p>
          <FooterLogo />
        </div>

        <div className="mt-14 hidden grid-cols-3 gap-x-12 lg:grid">
          {columns.map((column) => (
            <FooterColumn key={column.title} column={column} tone="dark" />
          ))}
        </div>
      </div>

      <FooterAccordion columns={columns} />

      <div className="border-t border-background/30">
        <div className="mx-auto flex w-full max-w-shell items-center justify-between gap-4 px-4 py-6 md:px-8 xl:px-12">
          <div className="text-body-sm text-background/80">
            <p>© 2026 Esencia Glow</p>
            <p className="mt-1">Desarrollado por Vidix Studio</p>
          </div>
          <div className="-mr-3">
            <FooterSocial tone="dark" />
          </div>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
