/** Repeticiones de la frase por grupo: suficientes para llenar el ancho aun con una frase corta. */
const REPEATS_PER_GROUP = 4;

/**
 * Cinta infinita del banner de oferta, solo con CSS: dos grupos idénticos, cada
 * uno de al menos el ancho de la pantalla, se desplazan juntos un ancho de
 * grupo y la animación reinicia sin que se note el corte. Es decorativa
 * (`aria-hidden`): la frase la anuncia el título de la sección. Con
 * `prefers-reduced-motion` queda quieta.
 */
function OfferMarquee({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div aria-hidden="true" className={`flex overflow-hidden select-none ${className}`}>
      {[0, 1].map((group) => (
        <div
          key={group}
          className="flex min-w-full shrink-0 animate-marquee items-center justify-around motion-reduce:animate-none"
        >
          {Array.from({ length: REPEATS_PER_GROUP }, (_, position) => (
            <span key={position} className="type-shop-marquee px-6 whitespace-nowrap md:px-10">
              {text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export { OfferMarquee };
