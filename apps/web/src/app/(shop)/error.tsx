"use client";

import { useEffect } from "react";
import { StateView } from "../../components/storefront/states/state-view";

/**
 * Error de render dentro de la tienda (el header y el footer siguen en pie).
 * Solo se muestra el `digest` como código de referencia: nunca el mensaje ni
 * el stack, que en desarrollo pueden traer detalles internos.
 */
export default function ShopError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <StateView kind="error" retry={retry} digest={error.digest} />;
}
