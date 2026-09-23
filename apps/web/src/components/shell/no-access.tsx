"use client";

import { LockSimple } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";
import { Button } from "../ui/button";

/**
 * DESIGN.md §5 Page States, Sin permisos: hoy no aplica (un solo operador),
 * pero se diseña desde ahora para no improvisarlo cuando haya roles. Se
 * muestra en vez de redirigir en silencio a /login, para no dar un ciclo
 * entre el panel y el login con una sesión perfectamente válida de un rol
 * que no es admin.
 */
function NoAccess() {
  const router = useRouter();

  async function handleLogout() {
    await apiRequest("/api/v1/auth/logout", { method: "POST", authenticated: true }).catch(() => {
      // El logout local (cookies) igual limpia la sesión del navegador al
      // recargar el login; no bloquear al operador si la API no responde.
    });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <LockSimple size={32} weight="regular" className="text-muted-foreground" aria-hidden="true" />
      <p className="text-subtitle text-foreground">No tienes permiso para entrar aquí</p>
      <p className="max-w-[42ch] text-body-sm text-muted-foreground-strong">
        Este panel es solo para administradores. Si crees que esto es un error, contacta a Manuel.
      </p>
      <Button variant="secondary" size="sm" className="mt-2" onClick={handleLogout}>
        Cerrar sesión
      </Button>
    </div>
  );
}

export { NoAccess };
