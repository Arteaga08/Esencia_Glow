"use client";

import { useRouter } from "next/navigation";
import { ErrorState } from "./error-state";

/**
 * Cuando no se pudo confirmar la sesión porque el API respondió "demasiadas
 * peticiones" o no estuvo disponible. NO es "inicia sesión": mandar al login
 * por un fallo temporal le quita la sesión a quien sí la tiene. Se ofrece
 * reintentar, que vuelve a pedir la página al servidor.
 */
function SessionUnavailable() {
  const router = useRouter();
  return (
    <ErrorState
      title="No pudimos verificar tu sesión"
      description="Hay mucho movimiento en este momento. Espera unos segundos e inténtalo de nuevo; tu sesión sigue abierta."
      onRetry={() => router.refresh()}
    />
  );
}

export { SessionUnavailable };
