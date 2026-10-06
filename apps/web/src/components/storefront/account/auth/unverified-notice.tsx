"use client";

import { formatCountdown, useResendVerification } from "./use-resend-verification";
import { TEXT_LINK } from "../shared/styles";

/**
 * Aviso del 403 al ingresar: la contraseña era correcta pero falta verificar el
 * correo. Ofrece pedir el enlace otra vez sin salir de la pantalla.
 */
function UnverifiedNotice({ email }: { email: string }) {
  const { status, error, secondsLeft, resend } = useResendVerification(email);
  const cooling = secondsLeft > 0;

  return (
    <div role="alert" className="rounded-md bg-accent px-4 py-3 text-body-sm text-accent-foreground-strong">
      <p className="font-medium">Todavía no verificas tu correo.</p>
      <p className="mt-0.5">Abre el enlace que te enviamos al crear tu cuenta, o pide uno nuevo.</p>
      {status === "sent" ? <p className="mt-1 font-medium">Si la cuenta existe, te enviamos un enlace nuevo. El anterior ya no sirve.</p> : null}
      {error ? <p className="mt-1">{error}</p> : null}
      <button
        type="button"
        onClick={resend}
        disabled={status === "sending" || cooling}
        className={`${TEXT_LINK} !text-accent-foreground-strong disabled:cursor-not-allowed disabled:no-underline disabled:opacity-70`}
      >
        {status === "sending" ? "Enviando…" : cooling ? `Enviar otra vez en ${formatCountdown(secondsLeft)}` : "Enviar el enlace otra vez"}
      </button>
    </div>
  );
}

export { UnverifiedNotice };
