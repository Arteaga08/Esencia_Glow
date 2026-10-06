"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { goToLogin, refreshSession } from "@/lib/storefront/account-api";

/** Si el refresco "funciona" pero el servidor sigue sin ver sesión, no se queda esperando para siempre. */
const GIVE_UP_AFTER_MS = 5000;

/**
 * Lo que ve quien llega a Mi cuenta sin un access token válido (dura 15 min;
 * el refresh token de 30 días solo viaja a `/api/v1/auth`, así que ni el
 * servidor de Next ni un middleware pueden usarlo). Intenta UN refresco
 * silencioso desde el navegador: si sale bien, vuelve a pedir la página; si no,
 * manda a ingresar con `?redirect=` a esta misma ruta.
 */
function SessionGate() {
  const router = useRouter();
  const pathname = usePathname();
  const attempted = useRef(false);

  useEffect(() => {
    // Strict Mode monta dos veces en desarrollo y el refresh token es de un solo uso.
    if (attempted.current) return;
    attempted.current = true;

    let giveUp: number | undefined;
    void refreshSession().then((ok) => {
      if (!ok) {
        goToLogin();
        return;
      }
      router.refresh();
      giveUp = window.setTimeout(goToLogin, GIVE_UP_AFTER_MS);
    });

    return () => window.clearTimeout(giveUp);
  }, [router, pathname]);

  return (
    <main className="pt-16 pb-40 xl:pt-20" aria-busy="true">
      <div className="mx-auto flex max-w-shell flex-col gap-4 px-4 py-14 md:px-8 xl:px-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full max-w-2xl" />
      </div>
    </main>
  );
}

export { SessionGate };
