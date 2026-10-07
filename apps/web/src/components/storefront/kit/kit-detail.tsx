import { Breadcrumb } from "@/components/storefront/catalog/breadcrumb";
import { ContentAccordion } from "@/components/storefront/product/content-accordion";
import { ProductGallery } from "@/components/storefront/product/product-gallery";
import type { KitView } from "@/lib/storefront/kit-view";
import { KitContents } from "./kit-contents";
import { KitPurchasePanel } from "./kit-purchase-panel";

/**
 * Página de un kit: misma estructura que la de producto (galería + compra
 * fija a la derecha) con "Qué incluye" debajo y, si el kit trae contenido
 * editorial, la banda rosa con acordeón. No hay bloque de sugeridos: se
 * arma por categoría y un kit no tiene.
 */
function KitDetail({ kit }: { kit: KitView }) {
  return (
    <main className="pt-16 xl:pt-20">
      <div className="mx-auto max-w-shell px-4 py-6 md:px-8 xl:px-12">
        <Breadcrumb trail={[{ name: "Kits", href: "/kits" }, { name: kit.name }]} />
      </div>

      <section className="mx-auto grid max-w-shell gap-8 px-4 pb-16 md:px-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-14 xl:px-12">
        <ProductGallery images={kit.images} />
        <div className="lg:sticky lg:top-28 lg:self-start">
          <KitPurchasePanel kit={kit} />
        </div>
      </section>

      <KitContents items={kit.items} />

      {kit.sections.length > 0 ? (
        <section aria-labelledby="kit-info-title" className="bg-blush">
          <div className="mx-auto grid max-w-shell gap-10 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-20 xl:px-12">
            <h2 id="kit-info-title" className="type-shop-section text-foreground">
              Información del kit
            </h2>
            <ContentAccordion sections={kit.sections} />
          </div>
        </section>
      ) : null}
    </main>
  );
}

export { KitDetail };
