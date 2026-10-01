"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HeroProgress } from "./hero-progress";

const SWIPE_THRESHOLD_PX = 50;

interface HeroCarouselSlide {
  id: string;
  title: string;
  node: ReactNode;
}

/**
 * Carrusel del hero. Los slides ya vienen renderizados desde el servidor
 * (`HeroSection`); aquí solo vive el estado: slide activo, pausa (hover,
 * foco, pestaña oculta), swipe y flechas del teclado. Todos los slides están
 * apilados y solo cambia la opacidad; los inactivos van `inert` para que ni
 * el teclado ni el lector de pantalla caigan en ellos. El autoplay lo manda
 * la animación de la barra (ver `HeroProgress`).
 */
function HeroCarousel({ slides }: { slides: HeroCarouselSlide[] }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const swipe = useRef<{ x: number; moved: boolean } | null>(null);

  const count = slides.length;
  const paused = hovered || focused || hidden;
  const go = (next: number) => setIndex(((next % count) + count) % count);

  useEffect(() => {
    function sync() {
      setHidden(document.hidden);
    }
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Destacados"
      onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(index - 1);
        if (event.key === "ArrowRight") go(index + 1);
      }}
      onPointerDown={(event) => {
        swipe.current = { x: event.clientX, moved: false };
      }}
      onPointerUp={(event) => {
        const start = swipe.current;
        swipe.current = null;
        if (!start || count < 2) return;
        const delta = event.clientX - start.x;
        if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
        swipe.current = { x: start.x, moved: true };
        go(delta < 0 ? index + 1 : index - 1);
      }}
      onClickCapture={(event) => {
        // Un swipe termina con un "click" sobre el enlace del slide: no navegar.
        if (swipe.current?.moved) {
          event.preventDefault();
          swipe.current = null;
        }
      }}
      className="relative h-svh min-h-[32rem] touch-pan-y select-none overflow-hidden bg-blush"
    >
      <div aria-live={paused || count < 2 ? "polite" : "off"}>
        {slides.map((slide, position) => (
          <div
            key={slide.id}
            inert={position !== index}
            aria-roledescription="diapositiva"
            aria-label={`${position + 1} de ${count}`}
            className={`absolute inset-0 transition-opacity duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none ${position === index ? "opacity-100" : "opacity-0"}`}
          >
            {slide.node}
          </div>
        ))}
      </div>
      {count > 1 ? (
        <HeroProgress
          count={count}
          index={index}
          paused={paused}
          labels={slides.map((slide) => slide.title)}
          onSelect={go}
          onFinish={() => go(index + 1)}
        />
      ) : null}
    </section>
  );
}

export { HeroCarousel };
export type { HeroCarouselSlide };
