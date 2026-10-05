import { CategoryImage } from "@/components/storefront/home/categories/category-image";
import type { CatalogCategory } from "@/lib/storefront/catalog";
import { Breadcrumb } from "./breadcrumb";

/**
 * Banner de la categoría: su foto a todo el ancho bajo el header y una placa
 * rosa esmerilada con migas, título y descripción. Una subcategoría sin foto
 * propia usa la de su categoría raíz; sin ninguna, queda el rosa liso.
 */
function CatalogBanner({ found }: { found: CatalogCategory }) {
  const { category, parent, root } = found;
  const image = category.image ?? parent?.image ?? root.image;
  const trail = [
    ...(parent ? [{ name: parent.name, href: `/categoria/${parent.slug}` }] : []),
    { name: category.name },
  ];

  return (
    <section className="relative isolate flex min-h-[24rem] items-end bg-blush md:min-h-[32rem]">
      <CategoryImage
        category={{ id: category.id, name: category.name, href: "", image: image ? { url: image.url, alt: image.alt } : undefined }}
        sizes="100vw"
        quality={90}
        priority
      />
      <div className="relative mx-auto w-full max-w-shell px-4 pb-6 md:px-8 md:pb-10 xl:px-12">
        <div className="max-w-xl rounded-md bg-blush/85 p-6 backdrop-blur-xl backdrop-saturate-150 md:p-8">
          <Breadcrumb trail={trail} />
          <h1 className="mt-4 type-shop-marquee text-foreground">{category.name}</h1>
          {category.description ? <p className="mt-3 text-body text-foreground/85">{category.description}</p> : null}
        </div>
      </div>
    </section>
  );
}

export { CatalogBanner };
