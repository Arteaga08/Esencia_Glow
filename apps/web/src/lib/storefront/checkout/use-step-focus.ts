"use client";

import { useEffect, useRef } from "react";
import type { MobileScreen } from "./checkout-machine";

/**
 * Al cambiar de paso, lleva el encabezado del paso nuevo a la vista y le da el foco.
 * Sin esto, al confirmar el envío el formulario alto se sustituye por un resumen de
 * dos renglones, la página se encoge y el navegador se queda parado en el footer.
 * En móvil el paso es la pantalla (encabezado `#checkout-mobile-step`); en escritorio,
 * la sección (`#step-N`). No corre en el primer render ni mueve nada si el paso no cambió.
 */
function useStepFocus(screen: MobileScreen, section: number) {
  const previous = useRef<{ screen: MobileScreen; section: number } | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = { screen, section };
    if (!before) return;

    const mobileHeader = document.getElementById("checkout-mobile-step");
    const onMobile = mobileHeader !== null && mobileHeader.offsetParent !== null;
    if (onMobile ? before.screen === screen : before.section === section) return;

    const target = onMobile ? mobileHeader : document.getElementById(`step-${section}`);
    if (!target) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    target.focus({ preventScroll: true });
  }, [screen, section]);
}

export { useStepFocus };
