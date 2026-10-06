"use client";

import { SignOut } from "@phosphor-icons/react";
import { useState } from "react";
import { apiRequest } from "@/lib/api";

/**
 * Cierra la sesión (`POST /auth/logout` borra las cookies) y recarga completo:
 * así ninguna pantalla autenticada queda en la caché del navegador.
 */
function LogoutButton({ className, children }: { className: string; children?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST", authenticated: true });
    } catch {
      // Sin red igual se sale a la pantalla de acceso: si la sesión sigue viva, el guard la valida.
    }
    // Recarga completa a propósito: ninguna pantalla autenticada queda en memoria.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/ingresar");
  }

  return (
    <button type="button" onClick={handleClick} disabled={busy} className={className}>
      {children ?? (
        <>
          <SignOut size={20} aria-hidden="true" />
          Cerrar sesión
        </>
      )}
    </button>
  );
}

export { LogoutButton };
