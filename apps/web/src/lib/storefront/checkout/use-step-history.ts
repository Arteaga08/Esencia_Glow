"use client";

import { useEffect, useRef } from "react";
import { SCREEN_ORDER, type MobileScreen } from "./checkout-machine";

/**
 * En móvil, el botón Atrás del navegador retrocede una pantalla del checkout en vez
 * de sacar de la tienda. Cada avance mete una entrada en el historial; al volver
 * atrás solo se actúa si la entrada a la que se llegó está ANTES de la pantalla
 * actual (una entrada vieja, dejada por un "Cambiar" en pantalla, no retrocede dos veces).
 * En escritorio (`lg`) no hace nada: las secciones están todas a la vista.
 */
function useStepHistory(screen: MobileScreen, onBack: () => void) {
  const previous = useRef(screen);
  const current = useRef(screen);
  const handler = useRef(onBack);

  useEffect(() => {
    handler.current = onBack;
    current.current = screen;
  });

  useEffect(() => {
    const isMobile = () => !window.matchMedia("(min-width: 1024px)").matches;
    if (isMobile() && SCREEN_ORDER[screen] > SCREEN_ORDER[previous.current]) {
      window.history.pushState({ checkoutScreen: screen }, "");
    }
    previous.current = screen;
  }, [screen]);

  useEffect(() => {
    function handlePopState(event: PopStateEvent) {
      if (window.matchMedia("(min-width: 1024px)").matches) return;
      const reached = (event.state as { checkoutScreen?: MobileScreen } | null)?.checkoutScreen;
      const reachedOrder = reached ? SCREEN_ORDER[reached] : 0;
      if (reachedOrder < SCREEN_ORDER[current.current]) handler.current();
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
}

export { useStepHistory };
