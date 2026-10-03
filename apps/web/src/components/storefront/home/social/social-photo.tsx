import Image from "next/image";
import type { SocialPhoto as SocialPhotoData } from "@/lib/storefront/social-feed";

interface SocialPhotoProps {
  photo: SocialPhotoData;
  sizes: string;
  /** Proporción y posición dentro de la rejilla (`aspect-*`, `row-span-*`...). */
  className?: string;
}

/**
 * Foto del bloque: enlaza al perfil. El respaldo `bg-blush` evita el hueco
 * mientras carga; el zoom del hover es solo `transform` y se apaga con
 * `motion-reduce`.
 */
function SocialPhoto({ photo, sizes, className = "aspect-[4/5]" }: SocialPhotoProps) {
  return (
    <a
      href={photo.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative block overflow-hidden rounded-md bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${className}`}
    >
      <Image
        src={photo.url}
        alt={photo.alt}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-[var(--duration-slow)] ease-out-quart group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </a>
  );
}

export { SocialPhoto };
