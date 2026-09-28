import { useEffect, useState } from "react";

const SEARCH_DEBOUNCE_MS = 300;

/** El buscador del inventario espera 300 ms antes de pedir (mismo valor que
 * Pedidos y Envíos). El reset de página lo hace `useInventoryList` durante el
 * render cuando cambia el valor ya estabilizado. */
function useDebouncedValue(value: string): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [value]);

  return debounced;
}

export { useDebouncedValue };
