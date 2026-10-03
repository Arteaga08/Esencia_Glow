import { getCategoryTree } from "@/lib/storefront/categories";
import { buildFooterColumns } from "@/lib/storefront/footer-links";
import { FooterColumn } from "./footer-column";
import { FooterSocial } from "./footer-social";
import { FooterWordmark } from "./footer-wordmark";
import { NewsletterForm } from "./newsletter-form";

/**
 * Footer del storefront (bloque 10 del home). Tinta café con el nombre de la
 * marca en rosa al inicio, cinco columnas y una fila final con el correo y las
 * redes. `--surface-bg` se declara para que el campo se pinte sobre el fondo
 * oscuro.
 */
async function SiteFooter() {
  const columns = buildFooterColumns(await getCategoryTree());

  return (
    <footer className="overflow-x-clip bg-foreground text-background [--surface-bg:var(--color-foreground)]">
      <div className="mx-auto max-w-shell px-4 pt-14 md:px-8 md:pt-20 xl:px-12">
        <FooterWordmark className="text-primary" />
      </div>

      <div className="mx-auto grid max-w-shell grid-cols-2 gap-x-6 gap-y-10 px-4 py-14 md:grid-cols-3 md:px-8 lg:grid-cols-5 xl:px-12">
        {columns.map((column) => (
          <FooterColumn key={column.title} column={column} tone="dark" />
        ))}
      </div>

      <div className="border-t border-background/30">
        <div className="mx-auto grid max-w-shell items-end gap-6 px-4 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-12 xl:px-12">
          <div className="max-w-xl">
            <NewsletterForm tone="dark" />
          </div>
          <p className="text-body-sm text-background/80 lg:pb-7">© 2026 Esencia Glow</p>
          <div className="lg:pb-5">
            <FooterSocial tone="dark" />
          </div>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
