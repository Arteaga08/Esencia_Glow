import Image from "next/image";
import type { SpotlightCoverImages } from "./spotlight-types";

interface SpotlightCoverProps {
  cover: SpotlightCoverImages;
  className?: string;
}

/**
 * Foto de portada: una imagen para escritorio y otra para móvil, solo una se
 * descarga según el breakpoint `lg`. El contenedor lo dimensiona quien la usa.
 * En móvil el recorte se ancla arriba: la parte baja la tapan las tarjetas.
 */
function SpotlightCover({ cover, className = "" }: SpotlightCoverProps) {
  return (
    <div className={`relative overflow-hidden bg-muted ${className}`}>
      <Image src={cover.desktop} alt={cover.alt} fill sizes="(min-width: 1024px) 48vw, 1px" className="hidden object-cover lg:block" />
      <Image
        src={cover.mobile}
        alt=""
        fill
        sizes="(min-width: 1024px) 1px, 100vw"
        className="object-cover object-top lg:hidden"
      />
    </div>
  );
}

export { SpotlightCover };
