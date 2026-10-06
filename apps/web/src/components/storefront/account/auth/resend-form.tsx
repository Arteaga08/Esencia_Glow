"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { validateEmail } from "../shared/validation";
import { CTA_DISABLED, CTA_PRIMARY } from "../shared/styles";
import { formatCountdown, useResendVerification } from "./use-resend-verification";

/**
 * Pide un enlace de verificación nuevo cuando el anterior venció. No se conoce el
 * correo (el enlace no lo trae), así que se pregunta.
 */
function ResendForm() {
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | undefined>();
  const { status, error, secondsLeft, resend } = useResendVerification(email.trim());

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateEmail(email);
    setLocalError(found);
    if (!found) void resend();
  }

  if (status === "sent" && secondsLeft > 0) {
    return (
      <p role="status" className="font-medium text-secondary-foreground">
        Si la cuenta existe y falta verificarla, te enviamos un enlace nuevo. El anterior ya no sirve.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-sm flex-col gap-4">
      <Input
        label="Correo de tu cuenta"
        name="email"
        type="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setLocalError(undefined);
        }}
        placeholder="maria.lopez@correo.mx"
        autoComplete="email"
        error={localError ?? error ?? undefined}
      />
      {status === "sending" || secondsLeft > 0 ? (
        <span className={CTA_DISABLED}>{status === "sending" ? "Enviando…" : `Pedir otro en ${formatCountdown(secondsLeft)}`}</span>
      ) : (
        <button type="submit" className={CTA_PRIMARY}>
          Pedir un enlace nuevo
        </button>
      )}
    </form>
  );
}

export { ResendForm };
