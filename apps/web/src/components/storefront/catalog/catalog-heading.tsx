import { Breadcrumb } from "./breadcrumb";

/**
 * Encabezado de un listado sin foto de categoría (Kits, Más vendidos): la
 * misma placa rosa y tipografía del banner del catálogo, sin imagen.
 */
function CatalogHeading({ title, description }: { title: string; description: string }) {
  return (
    <section className="bg-blush">
      <div className="mx-auto max-w-shell px-4 py-10 md:px-8 md:py-14 xl:px-12">
        <Breadcrumb trail={[{ name: title }]} />
        <h1 className="mt-4 type-shop-marquee text-foreground">{title}</h1>
        <p className="mt-3 max-w-xl text-body text-foreground/85">{description}</p>
      </div>
    </section>
  );
}

export { CatalogHeading };
