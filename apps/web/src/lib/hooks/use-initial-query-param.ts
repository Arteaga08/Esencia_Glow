import { useState } from "react";

/**
 * Lee UNA vez, al montar, un query param de la URL actual — para el link
 * "abre esta sección ya filtrada/enfocada" que el Resumen del panel manda a
 * Pedidos/Envíos/Inventario/Suscripciones (Milestone 2.9). Nunca vuelve a
 * leer tras el mount: es el valor INICIAL del filtro local de la página, que
 * de ahí en adelante manda `useState` como siempre — no sincroniza el
 * estado de vuelta a la URL (eso es otro problema, fuera de 2.9).
 *
 * `useState(() => …)` en vez de `next/navigation`'s `useSearchParams()`: las
 * páginas del panel son componentes cliente puros, y `useSearchParams` exige
 * un `<Suspense>` propio para no des-optimizar el render estático — leer
 * `window.location.search` directo evita esa complicación en una sola
 * lectura al montar.
 */
function useInitialQueryParam(key: string): string | null {
  const [value] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(key);
  });
  return value;
}

export { useInitialQueryParam };
