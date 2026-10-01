"use client";

import { useEffect, useState } from "react";

/**
 * `true` cuando la página bajó más de `threshold` px. Solo actualiza el
 * estado al cruzar el umbral (no en cada pixel de scroll), así que el
 * header no re-renderiza mientras se desplaza.
 */
function useScrolled(threshold = 16): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function sync() {
      setScrolled(window.scrollY > threshold);
    }
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, [threshold]);

  return scrolled;
}

export { useScrolled };
