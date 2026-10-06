"use client";

import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/ui/error-state";

/**
 * Cuando el servidor no pudo traer los datos de una sección (API caída, red). La
 * sesión ya se validó en el layout, así que esto NO es "inicia sesión": es un
 * fallo temporal y se ofrece reintentar.
 */
function LoadError({ what }: { what: string }) {
  const router = useRouter();
  return <ErrorState title="No pudimos cargar esta sección" description={`Hubo un problema al traer ${what}. Inténtalo de nuevo en un momento.`} onRetry={() => router.refresh()} />;
}

export { LoadError };
