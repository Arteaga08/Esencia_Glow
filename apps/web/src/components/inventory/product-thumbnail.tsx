import { ImageSquare } from "@phosphor-icons/react";
import type { PanelProductImage } from "@/lib/types/admin-inventory";

/**
 * Miniatura de 40px de la portada del producto, para reconocerlo de un
 * vistazo en la fila. `<img>` directo (no `next/image`), igual que
 * `product-card.tsx`: la URL es de Cloudinary y el panel no configura
 * `remotePatterns`. Sin foto, un recuadro neutro con ícono: nunca un hueco
 * que haga saltar la columna del nombre.
 */
function ProductThumbnail({ image }: { image: PanelProductImage | null }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt={image.alt ?? ""} loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageSquare size={18} className="text-muted-foreground" aria-hidden="true" />
      )}
    </span>
  );
}

export { ProductThumbnail };
