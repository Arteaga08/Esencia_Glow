"use client";

import { EnvelopeSimple } from "@phosphor-icons/react";
import { StatusPanel } from "../shared/status-panel";
import { CTA_DISABLED, CTA_SECONDARY, TEXT_LINK } from "../shared/styles";
import { formatCountdown, useResendVerification } from "./use-resend-verification";

interface CheckEmailProps {
  email: string;
  /** Vuelve al formulario para corregir el correo. */
  onChangeEmail: () => void;
}

/**
 * "Revisa tu correo": lo que ve quien acaba de crear su cuenta. La espera de 60 s
 * arranca desde que se registró, igual que la del servidor, para no prometer un
 * reenvío que el servidor no hará.
 */
function CheckEmail({ email, onChangeEmail }: CheckEmailProps) {
  const { status, error, secondsLeft, resend } = useResendVerification(email, true);
  const cooling = secondsLeft > 0;

  return (
    <StatusPanel
      icon={EnvelopeSimple}
      title="Revisa tu correo"
      actions={
        <>
          {cooling || status === "sending" ? (
            <span className={CTA_DISABLED} aria-disabled="true">
              {status === "sending" ? "Enviando…" : `Reenviar en ${formatCountdown(secondsLeft)}`}
            </span>
          ) : (
            <button type="button" onClick={resend} className={CTA_SECONDARY}>
              Reenviar el enlace
            </button>
          )}
          <button type="button" onClick={onChangeEmail} className={TEXT_LINK}>
            Usar otro correo
          </button>
        </>
      }
    >
      <p>
        Enviamos un enlace de verificación a <span className="font-medium text-foreground">{email}</span>. Ábrelo y escribe tu contraseña para activar la cuenta; vence en 24 horas.
      </p>
      {status === "sent" ? <p className="mt-3 font-medium text-secondary-foreground">Listo, pedimos un enlace nuevo. El anterior ya no sirve.</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-destructive-action">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-body-sm text-muted-foreground-strong">Puedes pedir otro enlace cada minuto. Revisa también tu carpeta de spam.</p>
    </StatusPanel>
  );
}

export { CheckEmail };
