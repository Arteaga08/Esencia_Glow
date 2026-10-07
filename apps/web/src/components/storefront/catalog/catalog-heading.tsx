import Image from "next/image";
import { Breadcrumb } from "./breadcrumb";

interface CatalogHeadingProps {
  title: string;
  description: string;
  /** Foto opcional (Ofertas la carga desde el panel). */
  image?: { url: string; alt?: string };
}

/**
 * Encabezado de un listado que no es una categoría (Kits, Más vendidos,
 * Ofertas). Sin foto: la placa rosa lisa. Con foto: el mismo banner del
 * catálogo por categoría, la foto a todo el ancho y la placa esmerilada encima.
 */
function CatalogHeading({ title, description, image }: CatalogHeadingProps) {
  if (!image) {
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

  return (
    <section className="relative isolate flex min-h-[24rem] items-end bg-blush md:min-h-[32rem]">
      <Image src={image.url} alt={image.alt ?? ""} fill sizes="100vw" quality={90} priority className="object-cover" />
      <div className="relative mx-auto w-full max-w-shell px-4 pb-6 md:px-8 md:pb-10 xl:px-12">
        <div className="max-w-xl rounded-md bg-blush/85 p-6 backdrop-blur-xl backdrop-saturate-150 md:p-8">
          <Breadcrumb trail={[{ name: title }]} />
          <h1 className="mt-4 type-shop-marquee text-foreground">{title}</h1>
          <p className="mt-3 text-body text-foreground/85">{description}</p>
        </div>
      </div>
    </section>
  );
}

export { CatalogHeading };
