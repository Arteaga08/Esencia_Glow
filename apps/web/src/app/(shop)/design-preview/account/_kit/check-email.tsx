import Link from "next/link";
import { EnvelopeSimple } from "@phosphor-icons/react/ssr";
import { StatusPanel } from "./status-panel";
import { CTA_DISABLED, CTA_SECONDARY, TEXT_LINK } from "./styles";

interface CheckEmailProps {
  /** `?estado=` de la vista: reenviado o espera. */
  state: string | null;
  email: string;
  headingClass?: string;
  resendHref: string;
  /** Pantalla de crear cuenta, para corregir el correo. */
  changeHref: string;
  /** Pantalla de llegada del enlace (en la vista previa, simula abrirlo). */
  openLinkHref: string;
}

/**
 * "Revisa tu correo": lo que ve quien acaba de crear su cuenta. El registro no
 * inicia sesión, así que esta pantalla es el único camino a la cuenta. Reenviar
 * tiene espera para no abrir la puerta a correos en ráfaga.
 */
function CheckEmail({ state, email, headingClass, resendHref, changeHref, openLinkHref }: CheckEmailProps) {
  const waiting = state === "espera";
  const resent = state === "reenviado";

  return (
    <StatusPanel
      icon={EnvelopeSimple}
      title="Revisa tu correo"
      headingClass={headingClass}
      actions={
        <>
          {waiting ? (
            <span className={CTA_DISABLED} aria-disabled="true">
              Reenviar en 0:42
            </span>
          ) : (
            <Link href={resendHref} className={CTA_SECONDARY}>
              Reenviar el enlace
            </Link>
          )}
          <Link href={changeHref} className={TEXT_LINK}>
            Usar otro correo
          </Link>
        </>
      }
    >
      <p>
        Enviamos un enlace de verificación a <span className="font-medium text-foreground">{email}</span>. Ábrelo y escribe tu contraseña para activar la cuenta; vence en 24 horas.
      </p>
      {resent ? <p className="mt-3 font-medium text-secondary-foreground">Listo, te mandamos un enlace nuevo. El anterior ya no sirve.</p> : null}
      {waiting ? <p className="mt-3 text-body-sm text-muted-foreground-strong">Puedes pedir otro enlace cada minuto. Revisa también tu carpeta de spam.</p> : null}
      <p className="mt-4 text-body-sm text-muted-foreground-strong">
        ¿Ya lo abriste?{" "}
        <Link href={openLinkHref} className="underline decoration-border-strong underline-offset-4 hover:decoration-foreground">
          Ver la confirmación
        </Link>
        .
      </p>
    </StatusPanel>
  );
}

export { CheckEmail };
