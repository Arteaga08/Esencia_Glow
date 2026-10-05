import Link from "next/link";
import { CheckCircle, LinkBreak } from "@phosphor-icons/react/ssr";
import { StatusPanel } from "./status-panel";
import { CTA_PRIMARY, CTA_SECONDARY } from "./styles";
import { VerifyForm } from "./verify-form";

interface VerifyResultProps {
  /** `?estado=` de la vista: incorrecta, listo o vencido; sin él, el formulario de contraseña. */
  state: string | null;
  headingClass?: string;
  loginHref: string;
  /** Pantalla de reenvío, cuando el enlace venció o ya se usó. */
  resendHref: string;
  /** Misma pantalla en estado `listo`. */
  doneHref: string;
  /** Pantalla para restablecer la contraseña. */
  forgotHref: string;
}

/** Llegada del enlace del correo: pide la contraseña, y termina en listo o en enlace vencido/usado. */
function VerifyResult({ state, headingClass, loginHref, resendHref, doneHref, forgotHref }: VerifyResultProps) {
  if (state === "listo") {
    return (
      <StatusPanel
        icon={CheckCircle}
        tone="success"
        title="Cuenta verificada"
        headingClass={headingClass}
        actions={
          <Link href={loginHref} className={CTA_PRIMARY}>
            Ingresar
          </Link>
        }
      >
        <p>Tu correo quedó confirmado. Ya puedes entrar con tu contraseña.</p>
      </StatusPanel>
    );
  }

  if (state === "vencido") {
    return (
      <StatusPanel
        icon={LinkBreak}
        tone="warning"
        role="alert"
        title="Este enlace ya no sirve"
        headingClass={headingClass}
        actions={
          <>
            <Link href={resendHref} className={CTA_PRIMARY}>
              Pedir un enlace nuevo
            </Link>
            <Link href={loginHref} className={CTA_SECONDARY}>
              Ingresar
            </Link>
          </>
        }
      >
        <p>Los enlaces de verificación duran 24 horas y se usan una sola vez. Pide uno nuevo y ábrelo desde el correo más reciente.</p>
      </StatusPanel>
    );
  }

  return <VerifyForm state={state} headingClass={headingClass} doneHref={doneHref} forgotHref={forgotHref} />;
}

export { VerifyResult };
