import type { ReactNode } from "react";

interface MarqueeProps {
  children: ReactNode;
  className?: string;
  /** Segundos que tarda en recorrer un grupo completo: más alto, más lento. */
  seconds?: number;
}

/**
 * Cinta infinita solo con CSS (misma técnica que `OfferMarquee`): dos grupos
 * idénticos, cada uno al menos del ancho de la pantalla, se desplazan juntos un
 * ancho de grupo y la animación reinicia sin corte. El segundo grupo es una
 * copia: va `inert` y `aria-hidden` para que lectores y teclado no la
 * recorran. Se detiene al pasar el cursor o enfocar un enlace; con
 * `prefers-reduced-motion` queda quieta, sin la copia, y se puede desplazar a
 * mano.
 */
function Marquee({ children, className = "", seconds = 32 }: MarqueeProps) {
  const style = { animationDuration: `${seconds}s` };

  return (
    <div
      className={`group/marquee flex overflow-hidden motion-reduce:overflow-x-auto motion-reduce:[scrollbar-width:none] ${className}`}
    >
      {[0, 1].map((group) => (
        <div
          key={group}
          style={style}
          inert={group === 1}
          aria-hidden={group === 1 ? true : undefined}
          className={`flex min-w-full shrink-0 animate-marquee items-center justify-around group-focus-within/marquee:[animation-play-state:paused] group-hover/marquee:[animation-play-state:paused] motion-reduce:animate-none ${group === 1 ? "motion-reduce:hidden" : ""}`}
        >
          {children}
        </div>
      ))}
    </div>
  );
}

export { Marquee };
