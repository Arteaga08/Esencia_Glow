"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { refreshSession } from "../account-api";

/** Si el refresco "funciona" pero el servidor sigue sin ver sesión, no se queda esperando para siempre. */
const GIVE_UP_AFTER_MS = 5000;

/**
 * El access token dura 15 minutos y el servidor de Next no puede usar el refresh
 * token (solo viaja a `/api/v1/auth`). Sin sesión, se intenta UN refresco
 * silencioso desde el navegador antes de mostrar el paso de cuenta: así quien
 * volvió después de un rato no ve un formulario de ingreso por error. Devuelve
 * `true` cuando ya se sabe si hay sesión.
 */
function useSessionCheck(hasSession: boolean): boolean {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  // Strict Mode monta dos veces en desarrollo y el refresh token es de un solo uso.
  const attempted = useRef(false);

  useEffect(() => {
    if (hasSession || attempted.current) return;
    attempted.current = true;

    void refreshSession().then((ok) => {
      if (!ok) {
        setChecked(true);
        return;
      }
      router.refresh();
      window.setTimeout(() => setChecked(true), GIVE_UP_AFTER_MS);
    });
  }, [hasSession, router]);

  return hasSession || checked;
}

export { useSessionCheck };
