"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthHeading } from "./auth-heading";
import { PasswordField } from "./password-field";
import { CTA_PRIMARY, TEXT_LINK } from "./styles";

interface VerifyFormProps {
  /** `?estado=` de la vista: `incorrecta` arranca con el error de contraseña. */
  state: string | null;
  headingClass?: string;
  /** Pantalla de éxito. */
  doneHref: string;
  /** Pantalla para restablecer, si no recuerda la contraseña. */
  forgotHref: string;
}

/**
 * Llegada del enlace del correo: pide la contraseña con la que se creó la
 * cuenta. Es lo que impide que alguien registre el correo ajeno y aproveche
 * que la dueña abra el enlace (ella no conoce esa contraseña). Un error de
 * tecla no gasta el enlace.
 */
function VerifyForm({ state, headingClass, doneHref, forgotHref }: VerifyFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState(state === "incorrecta" ? "GlowRosa20" : "");
  const [error, setError] = useState<string | undefined>(
    state === "incorrecta" ? "Esa no es la contraseña de tu cuenta. Revísala e inténtalo de nuevo." : undefined,
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length === 0) {
      setError("Falta tu contraseña.");
      return;
    }
    router.push(doneHref);
  }

  return (
    <div>
      <AuthHeading title="Activa tu cuenta" lead="Escribe la contraseña con la que creaste tu cuenta para confirmar que eres tú." headingClass={headingClass} />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <PasswordField
          label="Contraseña"
          name="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setError(undefined);
          }}
          placeholder="Tu contraseña"
          autoComplete="current-password"
          error={error}
        />
        <button type="submit" className={`${CTA_PRIMARY} w-full`}>
          Activar mi cuenta
        </button>
        <Link href={forgotHref} className={`${TEXT_LINK} self-start`}>
          No la recuerdo, quiero crear otra
        </Link>
      </form>
    </div>
  );
}

export { VerifyForm };
