"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, LinkBreak } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { AuthHeading } from "./auth-heading";
import { describeMissing } from "./password";
import { PasswordField } from "./password-field";
import { StatusPanel } from "./status-panel";
import { CTA_PRIMARY, CTA_SECONDARY, TEXT_LINK } from "./styles";
import { compact } from "./validation";

interface ResetFormProps {
  /** `?estado=` de la vista: errores, vencido o listo. */
  state: string | null;
  headingClass?: string;
  loginHref: string;
  /** Pantalla para pedir otro enlace. */
  forgotHref: string;
  /** Misma pantalla en estado `listo`. */
  doneHref: string;
}

function validate(password: string, confirm: string) {
  return compact({
    password: describeMissing(password),
    confirm: confirm.length === 0 ? "Repite tu contraseña." : confirm !== password ? "Las contraseñas no coinciden." : undefined,
  });
}

/**
 * Contraseña nueva, a la que se llega desde el enlace del correo. Al guardarla
 * se cierran todas las sesiones abiertas (por eso termina en "Ingresar", no en
 * Mi cuenta).
 */
function ResetForm({ state, headingClass, loginHref, forgotHref, doneHref }: ResetFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState(state === "errores" ? "hola2026" : "");
  const [confirm, setConfirm] = useState(state === "errores" ? "hola" : "");
  const [errors, setErrors] = useState<Record<string, string>>(() => (state === "errores" ? validate("hola2026", "hola") : {}));

  if (state === "listo") {
    return (
      <StatusPanel
        icon={CheckCircle}
        tone="success"
        title="Contraseña actualizada"
        headingClass={headingClass}
        actions={
          <Link href={loginHref} className={CTA_PRIMARY}>
            Ingresar
          </Link>
        }
      >
        <p>Por seguridad cerramos tu sesión en todos tus dispositivos. Entra de nuevo con la contraseña nueva.</p>
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
            <Link href={forgotHref} className={CTA_PRIMARY}>
              Pedir un enlace nuevo
            </Link>
            <Link href={loginHref} className={CTA_SECONDARY}>
              Ingresar
            </Link>
          </>
        }
      >
        <p>Los enlaces para cambiar la contraseña duran 15 minutos y se usan una sola vez. Pide uno nuevo desde el correo más reciente.</p>
      </StatusPanel>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate(password, confirm);
    setErrors(found);
    if (Object.keys(found).length === 0) router.push(doneHref);
  }

  return (
    <div>
      <AuthHeading title="Crea tu contraseña nueva" lead="Elige una que no uses en ningún otro sitio." headingClass={headingClass} />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <PasswordField label="Contraseña nueva" name="password" value={password} onChange={setPassword} placeholder="Crea una contraseña" autoComplete="new-password" showStrength error={errors.password} />
        <PasswordField label="Repite la contraseña" name="confirm" value={confirm} onChange={setConfirm} placeholder="Escríbela otra vez" autoComplete="new-password" error={errors.confirm} />
        <button type="submit" className={`${CTA_PRIMARY} w-full`}>
          Guardar contraseña
        </button>
        <Link href={loginHref} className={`${TEXT_LINK} self-start`}>
          Cancelar
        </Link>
      </form>
    </div>
  );
}

export { ResetForm };
