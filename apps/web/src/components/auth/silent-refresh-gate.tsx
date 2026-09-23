"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { apiRequest } from "../../lib/api";
import { Skeleton } from "../ui/skeleton";

/**
 * Intento de refresco silencioso (hallazgo de code review, Milestone 2.1):
 * el guard server-side ((admin)/layout.tsx vía lib/session.ts) solo revisa
 * `access_token` (dura 15 minutos, `ACCESS_TOKEN_TTL`); si expiró pero
 * `refresh_token` sigue vivo (30 días), el operador cae aquí en vez de
 * seguir en el panel. Sin este intento, tendría que volver a loguearse
 * (contraseña + 2FA) con una sesión que en realidad seguía siendo válida —
 * inaceptable en producción real.
 *
 * Por qué es del NAVEGADOR y no un middleware del servidor de Next: se
 * intentó primero con un `proxy.ts` que leía `refresh_token` de la petición
 * entrante y llamaba a la API por dentro — no funciona, porque
 * `refresh_token` tiene `path: "/api/v1/auth"` a propósito
 * (apps/api/src/utils/cookies.ts), para minimizar dónde viaja. El
 * navegador JAMÁS lo adjunta a una petición a este dashboard
 * (`www.<dominio>/lo-que-sea`), sin importar `COOKIE_DOMAIN` — el `path` no
 * coincide y el dominio compartido no cambia eso. Solo lo adjunta cuando el
 * navegador mismo llama directo a `POST /auth/refresh`, que es exactamente
 * lo que hace este componente.
 */
function SilentRefreshGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "show-login">("checking");
  const attempted = useRef(false);
  // Compartido entre invocaciones del efecto (a diferencia de un `let`
  // local): el doble monta/desmonta/monta de Strict Mode en desarrollo deja
  // el cleanup del primer montaje marcando esto en `true` justo antes de que
  // el segundo montaje lo reponga en `false` — así la promesa lanzada en el
  // primer montaje (la única que en verdad corre, ver `attempted` abajo)
  // sigue pudiendo actualizar estado cuando responde. Antes esto era un
  // `let cancelled` por invocación del efecto: como la segunda invocación
  // hacía `return` temprano por `attempted.current`, nunca creaba su propio
  // `cancelled`, y el de la primera invocación quedaba en `true` para
  // siempre — el estado nunca salía de "checking" (pantalla del login
  // atascada en los skeletons).
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    // Evita el doble intento del Strict Mode de React en desarrollo
    // (monta/desmonta/monta el efecto) — un refresh_token es de un solo uso,
    // un segundo intento con el mismo token revocaría toda la sesión
    // (rotateSession, apps/api/src/services/session.service.ts).
    if (!attempted.current) {
      attempted.current = true;

      apiRequest("/api/v1/auth/refresh", { method: "POST", authenticated: true })
        .then(() => {
          if (cancelledRef.current) return;
          router.replace("/");
          router.refresh();
        })
        .catch(() => {
          // Sin refresh_token, o ya expiró: no hay nada que refrescar — se
          // muestra el login normal, sin mensaje de error (no fue un intento
          // fallido del operador, fue esta comprobación silenciosa).
          if (!cancelledRef.current) setState("show-login");
        });
    }

    return () => {
      cancelledRef.current = true;
    };
  }, [router]);

  if (state === "checking") {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return children;
}

export { SilentRefreshGate };
