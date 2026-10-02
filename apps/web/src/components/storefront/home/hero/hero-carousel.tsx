"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HeroProgress } from "./hero-progress";

const SWIPE_THRESHOLD_PX = 50;
/** Tiempo de cada slide en el autoplay. */
const AUTOPLAY_MS = 5000;

interface HeroCarouselSlide {
  id: string;
  title: string;
  node: ReactNode;
}

/**
 * Carrusel del hero. Los slides ya vienen renderizados desde el servidor
 * (`HeroSection`); aquí solo vive el estado: slide activo, pausa (hover,
 * foco, pestaña oculta), swipe y flechas del teclado (globales mientras el
 * hero está a la vista). Todos los slides están
 * apilados y solo cambia la opacidad; los inactivos van `inert` para que ni
 * el teclado ni el lector de pantalla caigan en ellos. El autoplay es un
 * temporizador que se reinicia con cada cambio de slide (también al elegir uno
 * a mano) y se detiene en pausa; con `prefers-reduced-motion` no hay autoplay.
 */
function HeroCarousel({ slides }: { slides: HeroCarouselSlide[] }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const section = useRef<HTMLElement>(null);
  const visible = useRef(false);
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

  // Flechas del teclado: valen mientras el hero esté en pantalla, sin exigir
  // foco dentro; se ignoran en campos de texto y con modificadores.
  useEffect(() => {
    const el = section.current;
    if (!el || count < 2) return;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = (entry?.intersectionRatio ?? 0) >= 0.5;
    }, { threshold: [0, 0.5, 1] });
    observer.observe(el);
    function onKey(event: KeyboardEvent) {
      if (!visible.current || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      setIndex((current) => (((current + (event.key === "ArrowRight" ? 1 : -1)) % count) + count) % count);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  }, [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timeout = setTimeout(() => setIndex((current) => (current + 1) % count), AUTOPLAY_MS);
    return () => clearTimeout(timeout);
  }, [index, paused, count]);

  return (
    <section
      ref={section}
      aria-roledescription="carrusel"
      aria-label="Destacados"
      onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
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
        // `detail === 0` es una activación por teclado o lector de pantalla,
        // que nunca viene de un swipe: se deja pasar. El flag se limpia siempre.
        const moved = swipe.current?.moved;
        swipe.current = null;
        if (moved && event.detail > 0) event.preventDefault();
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
          labels={slides.map((slide) => slide.title)}
          onSelect={go}
        />
      ) : null}
    </section>
  );
}

export { HeroCarousel };
export type { HeroCarouselSlide };
