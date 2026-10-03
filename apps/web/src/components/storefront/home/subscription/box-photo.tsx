import Image from "next/image";

interface BoxPhotoData {
  url: string;
  alt: string;
}

interface BoxPhotoProps {
  photo: BoxPhotoData | null;
  name: string;
  sizes: string;
  className?: string;
}

/** Foto de la caja; si el plan no tiene, una banda `blush` con el nombre para que el bloque no quede vacío. */
function BoxPhoto({ photo, name, sizes, className = "" }: BoxPhotoProps) {
  return (
    <div className={`relative overflow-hidden bg-blush ${className}`}>
      {photo ? (
        <Image src={photo.url} alt={photo.alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center type-shop-section text-foreground/60">
          {name}
        </p>
      )}
    </div>
  );
}

export { BoxPhoto };
export type { BoxPhotoData };
