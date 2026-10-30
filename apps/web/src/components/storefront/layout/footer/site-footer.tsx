import { getCategoryTree } from "@/lib/storefront/categories";
import { buildFooterColumns } from "@/lib/storefront/footer-links";
import { FooterAccordion } from "./footer-accordion";
import { FooterColumn } from "./footer-column";
import { FooterLogo } from "./footer-logo";
import { FooterSocial } from "./footer-social";
import { NewsletterForm } from "./newsletter-form";

/**
 * Footer del storefront (bloque 10 del home). Tinta. Dos zonas: a la izquierda
 * el logo centrado con su frase y el correo; a la derecha las cuatro columnas
 * en rejilla de 2x2 (desde `lg`). En móvil las columnas pasan a acordeón bajo
 * el bloque de marca. Fila final con créditos y redes. `--surface-bg` se
 * declara para que el campo se pinte sobre el fondo oscuro.
 */
async function SiteFooter() {
  const columns = buildFooterColumns(await getCategoryTree());

  return (
    <footer className="flex flex-col overflow-x-clip bg-foreground text-background [--surface-bg:var(--color-foreground)]">
      <div className="mx-auto grid w-full max-w-shell gap-10 px-4 pb-10 pt-12 md:px-8 lg:grid-cols-12 lg:gap-16 lg:pb-16 lg:pt-16 xl:px-12">
        <div className="flex flex-col items-center text-center lg:col-span-5">
          <FooterLogo />
          <p className="mt-2 max-w-sm text-subtitle text-background/80">Skincare y lifestyle con suscripción curada.</p>
          <div className="mt-8 w-full max-w-md text-left">
            <NewsletterForm tone="dark" />
          </div>
        </div>

        <div className="hidden grid-cols-2 gap-x-8 gap-y-12 lg:col-span-7 lg:grid lg:pt-6 xl:pl-10">
          {columns.map((column) => (
            <FooterColumn key={column.title} column={column} tone="dark" />
          ))}
        </div>
      </div>

      <FooterAccordion columns={columns} />

      <div className="border-t border-background/30">
        <div className="mx-auto flex w-full max-w-shell flex-col gap-3 px-4 py-6 md:px-8 lg:flex-row lg:items-center lg:justify-between xl:px-12">
          <div className="text-body-sm text-background/80">
            <p>© 2026 Esencia Glow</p>
            <p className="mt-1">Desarrollado por Vidix Studio</p>
          </div>
          <div className="-ml-3 lg:ml-0">
            <FooterSocial tone="dark" />
          </div>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
