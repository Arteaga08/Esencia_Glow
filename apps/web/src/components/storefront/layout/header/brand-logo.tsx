import Image from "next/image";
import Link from "next/link";

/**
 * Logo de la marca (PNG dorado con fondo transparente, `public/brand/logo.png`).
 * El nombre accesible va en el enlace; la imagen es decorativa para no repetirlo.
 */
function BrandLogo({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label="Esencia Glow, ir al inicio"
      className="inline-flex min-h-11 shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <Image
        src="/brand/logo.png"
        alt=""
        width={1050}
        height={627}
        sizes="140px"
        priority
        className="h-14 w-auto xl:h-[4.25rem]"
      />
    </Link>
  );
}

export { BrandLogo };
