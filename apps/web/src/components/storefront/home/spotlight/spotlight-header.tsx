import Link from "next/link";
import { VIEW_ALL_BUTTON } from "../shelf/shelf-button-styles";

interface SpotlightHeaderProps {
  title: string;
  subtitle?: string;
  /** Destino del botón "Ver todo", que va arriba, junto al título. */
  href: string;
}

/** Cabecera del bloque: título, subtítulo y "Ver todo" centrados sobre fondo limpio, nunca encima de la foto. */
function SpotlightHeader({ title, subtitle, href }: SpotlightHeaderProps) {
  return (
    <header className="mx-auto mb-10 flex max-w-shell flex-col items-center px-4 text-center md:mb-12">
      <h2 className="type-shop-section text-foreground">{title}</h2>
      {subtitle ? <p className="mt-3 max-w-[48ch] text-subtitle text-foreground/80">{subtitle}</p> : null}
      <Link href={href} className={`${VIEW_ALL_BUTTON} mt-6`}>
        Ver todo
      </Link>
    </header>
  );
}

export { SpotlightHeader };
