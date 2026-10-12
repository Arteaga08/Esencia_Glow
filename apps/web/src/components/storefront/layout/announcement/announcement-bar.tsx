import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getHomeContent } from "../../../../lib/storefront/home";
import { Marquee } from "../marquee";

/** Repeticiones de la frase por grupo: bastan para llenar el ancho aun con una frase corta. */
const REPEATS_PER_GROUP = 3;

/**
 * Aviso arriba del menú en toda la tienda (por ejemplo el envío gratis). La
 * frase y el enlace opcional los edita la clienta en Contenido del home; apagado
 * o sin API no se pinta. Va en el flujo normal, antes del header, así que se va
 * con el scroll y el menú queda pegado arriba. Tinta con texto crema, como el
 * footer. La frase la lee el lector de pantalla una sola vez (`sr-only`); la
 * cinta es decorativa.
 */
async function AnnouncementBar() {
  const announcement = (await getHomeContent())?.announcement;
  if (!announcement) return null;

  const ribbon = (
    <>
      <span className="sr-only">{announcement.text}</span>
      <span aria-hidden="true" className="block">
        <Marquee seconds={30}>
          {Array.from({ length: REPEATS_PER_GROUP }, (_, position) => (
            <span
              key={position}
              className="flex h-9 items-center gap-8 px-4 type-shop-cta whitespace-nowrap md:gap-10 md:px-5"
            >
              {announcement.text}
              <Plus size={10} weight="bold" />
            </span>
          ))}
        </Marquee>
      </span>
    </>
  );

  return (
    <div className="bg-foreground text-background">
      {announcement.href ? (
        <Link
          href={announcement.href}
          className="block cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          {ribbon}
        </Link>
      ) : (
        ribbon
      )}
    </div>
  );
}

export { AnnouncementBar };
