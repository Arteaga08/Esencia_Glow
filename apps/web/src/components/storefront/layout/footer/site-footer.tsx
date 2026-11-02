import { getCategoryTree } from "@/lib/storefront/categories";
import { buildFooterColumns } from "@/lib/storefront/footer-links";
import { FooterAccordion } from "./footer-accordion";
import { FooterColumn } from "./footer-column";
import { FooterSocial } from "./footer-social";
import { FooterWordmark } from "./footer-wordmark";

/**
 * Footer del storefront (bloque 10 del home). Tinta café. En escritorio: nombre
 * de la marca en rosa arriba, cuatro columnas y una fila final con créditos y
 * redes. En móvil: acordeones, redes, la marca a todo el ancho y los créditos;
 * el orden cambia con `order`, y la fila final usa `contents` para que sus
 * hijos se ordenen en el footer.
 */
async function SiteFooter() {
  const columns = buildFooterColumns(await getCategoryTree());

  return (
    <footer className="flex flex-col overflow-x-clip bg-foreground text-background">
      <div className="order-4 mx-auto w-full max-w-shell px-4 pb-8 pt-4 md:px-8 lg:order-1 lg:pb-0 lg:pt-20 xl:px-12">
        <FooterWordmark className="text-primary" />
      </div>

      <div className="order-2 lg:order-2">
        <FooterAccordion columns={columns} />
        <div className="mx-auto hidden max-w-shell grid-cols-4 gap-x-6 px-8 py-14 lg:grid xl:px-12">
          {columns.map((column) => (
            <FooterColumn key={column.title} column={column} tone="dark" />
          ))}
        </div>
      </div>

      <div className="contents lg:order-3 lg:block lg:border-t lg:border-background/30">
        <div className="contents lg:mx-auto lg:grid lg:max-w-shell lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12 lg:px-8 lg:py-8 xl:px-12">
          <div className="order-5 px-4 pb-8 text-body-sm text-background/80 lg:order-none lg:p-0">
            <p>© 2026 Esencia Glow</p>
            <p className="mt-1">Desarrollado por Vidix Studio</p>
          </div>
          <div className="order-3 px-3 pt-4 lg:order-none lg:p-0">
            <FooterSocial tone="dark" />
          </div>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
