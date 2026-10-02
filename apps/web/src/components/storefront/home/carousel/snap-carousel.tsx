"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { ARROW_BUTTON } from "../shelf/shelf-button-styles";

const NEAR_PX = 140;

interface SnapCarouselProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T, position: number) => ReactNode;
  /** Nombre accesible del carrusel ("Productos", "Categorías"). */
  label: string;
  /** Clases del `<li>`: el ancho por breakpoint (`basis-*`) de cada tarjeta. */
  itemClassName: string;
  /**
   * Alto de las flechas respecto del carrusel, en `cqw`, para centrarlas sobre
   * la foto (la mitad de su alto depende del ancho de la tarjeta y su
   * proporción). Cadena literal, para que Tailwind la detecte.
   */
  arrowTopClassName: string;
  /** Separación entre tarjetas. */
  gapClassName?: string;
  /** Separación entre el carrusel y la barra de avance. */
  barClassName?: string;
}

/**
 * Carrusel nativo: scroll horizontal con `scroll-snap` (el swipe en móvil y la
 * rueda del trackpad salen gratis). Las flechas flotan sobre las fotos y solo
 * aparecen (opacidad + un desplazamiento mínimo) cuando el cursor se acerca a
 * ellas (a menos de `NEAR_PX`) o reciben foco de teclado; en táctil no se
 * muestran, se desliza con el dedo. La barra de progreso permanece oculta hasta
 * el primer desplazamiento; luego se mueve por
 * `transform` desde un ref, sin re-render por pixel. Lo comparten el estante
 * de Más vendidos y el bloque de categorías.
 */
function SnapCarousel<T>({
  items,
  getKey,
  renderItem,
  label,
  itemClassName,
  arrowTopClassName,
  gapClassName = "gap-4",
  barClassName = "mt-10",
}: SnapCarouselProps<T>) {
  const scroller = useRef<HTMLUListElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const prev = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [moved, setMoved] = useState(false);
  const [near, setNear] = useState({ prev: false, next: false });

  const sync = useCallback(() => {
    const el = scroller.current;
    const bar = thumb.current;
    if (!el || !bar) return;
    const max = el.scrollWidth - el.clientWidth;
    const ratio = el.scrollWidth > 0 ? el.clientWidth / el.scrollWidth : 1;
    const track = bar.parentElement!.clientWidth;
    const progress = max > 0 ? el.scrollLeft / max : 0;
    bar.style.width = `${ratio * 100}%`;
    bar.style.transform = `translateX(${progress * (1 - ratio) * track}px)`;
    setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft >= max - 1 });
    if (el.scrollLeft > 1) setMoved(true);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sync]);

  /** Distancia del cursor al centro de una flecha, para saber si "se acerca". */
  function isNear(event: PointerEvent, button: HTMLButtonElement | null) {
    if (!button || event.pointerType !== "mouse") return false;
    const box = button.getBoundingClientRect();
    return Math.hypot(event.clientX - (box.left + box.width / 2), event.clientY - (box.top + box.height / 2)) < NEAR_PX;
  }

  function handlePointerMove(event: PointerEvent) {
    setNear({ prev: isNear(event, prev.current), next: isNear(event, next.current) });
  }

  function page(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const hidden = "pointer-events-none opacity-0 [@media(hover:none)]:hidden focus-visible:pointer-events-auto focus-visible:opacity-100";
  const shown = "pointer-events-auto opacity-100 translate-x-0";

  return (
    <div role="group" aria-roledescription="carrusel" aria-label={label} className="@container">
      <div className="relative" onPointerMove={handlePointerMove} onPointerLeave={() => setNear({ prev: false, next: false })}>
        <ul
          ref={scroller}
          onScroll={sync}
          className={`flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${gapClassName}`}
        >
          {items.map((item, position) => (
            <li key={getKey(item)} className={`shrink-0 snap-start ${itemClassName}`}>
              {renderItem(item, position)}
            </li>
          ))}
        </ul>

        <button
          type="button"
          ref={prev}
          aria-label="Anterior"
          disabled={edges.start}
          onClick={() => page(-1)}
          className={`${ARROW_BUTTON} ${near.prev ? shown : `${hidden} -translate-x-1`} absolute left-4 -translate-y-1/2 disabled:!opacity-0 ${arrowTopClassName}`}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          ref={next}
          aria-label="Siguiente"
          disabled={edges.end}
          onClick={() => page(1)}
          className={`${ARROW_BUTTON} ${near.next ? shown : `${hidden} translate-x-1`} absolute right-4 -translate-y-1/2 disabled:!opacity-0 ${arrowTopClassName}`}
        >
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>

      <div aria-hidden="true" className={`relative h-0.5 bg-primary/30 transition-opacity duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none ${moved ? "opacity-100" : "opacity-0"} ${barClassName}`}>
        <span ref={thumb} className="absolute inset-y-0 left-0 bg-primary will-change-transform" />
      </div>
    </div>
  );
}

export { SnapCarousel };
