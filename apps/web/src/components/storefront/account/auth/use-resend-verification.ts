"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { classifyError } from "@/lib/storefront/auth-errors";

/** El servidor no emite otro enlace antes de 60 s (y responde igual); la pantalla respeta la misma espera. */
const RESEND_COOLDOWN_SECONDS = 60;

type ResendStatus = "idle" | "sending" | "sent" | "error";

/**
 * Reenvío del enlace de verificación con enfriamiento. La API responde siempre
 * lo mismo exista o no la cuenta, así que "enviado" solo significa "lo pedimos".
 * `startCooling` arranca la espera sin enviar (la pantalla "revisa tu correo" ya
 * acaba de mandar uno al registrarse).
 */
function useResendVerification(email: string, startCooling = false) {
  const [status, setStatus] = useState<ResendStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(startCooling ? RESEND_COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const resend = useCallback(async () => {
    setStatus("sending");
    setError(null);
    try {
      await apiRequest("/api/v1/auth/resend-verification", { method: "POST", body: { email } });
      setStatus("sent");
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (caught) {
      const failure = classifyError(caught);
      setStatus("error");
      setError(failure.fieldErrors.email ?? failure.message);
      // Con el límite del servidor, esperar es lo único que sirve.
      if (failure.kind === "rateLimited") setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    }
  }, [email]);

  return { status, error, secondsLeft, resend };
}

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export { useResendVerification, formatCountdown };
