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
 * manda a ingresar con `?redirect=` a esta misma ruta. También lo pinta cada
 * página de Mi cuenta cuando su lectura da 401 (el layout no se vuelve a ejecutar
 * en la navegación cliente), con `bare` para no anidar un segundo `<main>`.
 */
function SessionGate({ bare = false }: { bare?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const attempted = useRef(false);
  // En un ref, no en una variable del efecto: Strict Mode simula un desmontaje y
  // el segundo montaje no vuelve a correr el efecto (ver `attempted`), así que
  // el temporizador tiene que poder limpiarse desde un efecto aparte.
  const giveUpTimer = useRef<number | undefined>(undefined);
  const unmounted = useRef(false);

  useEffect(() => {
    // Strict Mode monta dos veces en desarrollo y el refresh token es de un solo uso.
    if (attempted.current) return;
    attempted.current = true;

    void refreshSession().then((ok) => {
      // Se desmontó mientras refrescaba: la página ya no está, no hay a qué reaccionar.
      if (unmounted.current) return;
      if (!ok) {
        goToLogin();
        return;
      }
      router.refresh();
      giveUpTimer.current = window.setTimeout(goToLogin, GIVE_UP_AFTER_MS);
    });
  }, [router, pathname]);

  // Al desmontar (la página ya se repintó con sesión) el temporizador no debe disparar.
  useEffect(() => {
    // Strict Mode vuelve a correr este efecto tras su desmontaje simulado: hay que rearmar la marca.
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      window.clearTimeout(giveUpTimer.current);
    };
  }, []);

  const skeleton = (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40 w-full max-w-2xl" />
    </div>
  );

  // `bare`: dentro de una página de Mi cuenta, que ya vive en el `<main>` del marco.
  if (bare) return skeleton;

  return (
    <main className="pt-16 pb-40 xl:pt-20" aria-busy="true">
      <div className="mx-auto max-w-shell px-4 py-14 md:px-8 xl:px-12">{skeleton}</div>
    </main>
  );
}

export { SessionGate };
