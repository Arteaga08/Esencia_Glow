"use client";

import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { FieldError } from "@/components/ui/field-error";
import { apiRequest } from "@/lib/api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { AuthHeading } from "../shared/auth-heading";
import { describeMissing } from "../shared/password";
import { PasswordField } from "../shared/password-field";
import { StatusPanel } from "../shared/status-panel";
import { CTA_PRIMARY, TEXT_LINK } from "../shared/styles";
import { compact } from "../shared/validation";
import { InvalidLinkPanel } from "./invalid-link-panel";
import { SubmitButton } from "./submit-button";

type Step = "form" | "done" | "invalid";

function validate(password: string, confirm: string) {
  return compact({
    password: describeMissing(password),
    confirm: confirm.length === 0 ? "Repite tu contraseña." : confirm !== password ? "Las contraseñas no coinciden." : undefined,
  });
}

/**
 * Contraseña nueva, a la que se llega desde el enlace del correo. Al guardarla se
 * cierran todas las sesiones abiertas (por eso termina en "Ingresar", no en Mi
 * cuenta). Un 400 sin errores por campo es el enlace vencido; con errores por
 * campo es una contraseña que el API no acepta (p. ej. una filtrada) y el enlace
 * sigue vivo.
 */
function ResetForm({ token }: { token: string | null }) {
  const [step, setStep] = useState<Step>(token ? "form" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !token) return;

    const found = validate(password, confirm);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await apiRequest("/api/v1/auth/reset-password", { method: "POST", body: { token, password } });
      setStep("done");
    } catch (caught) {
      const failure = classifyError(caught);
      if (failure.kind === "invalid" && failure.fieldErrors.password) setErrors({ password: failure.fieldErrors.password });
      else if (failure.kind === "invalid" && /filtraciones/i.test(failure.message)) setErrors({ password: failure.message });
      else if (failure.kind === "invalid") setStep("invalid");
      else setFormError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <StatusPanel
        icon={CheckCircle}
        tone="success"
        title="Contraseña actualizada"
        actions={
          <Link href="/ingresar" className={CTA_PRIMARY}>
            Ingresar
          </Link>
        }
      >
        <p>Por seguridad cerramos tu sesión en todos tus dispositivos. Entra de nuevo con la contraseña nueva.</p>
      </StatusPanel>
    );
  }

  if (step === "invalid") {
    return (
      <InvalidLinkPanel
        actions={
          <Link href="/recuperar-contrasena" className={CTA_PRIMARY}>
            Pedir un enlace nuevo
          </Link>
        }
      >
        <p>Los enlaces para cambiar la contraseña duran 15 minutos y se usan una sola vez. Pide uno nuevo desde el correo más reciente.</p>
      </InvalidLinkPanel>
    );
  }

  return (
    <div>
      <AuthHeading title="Crea tu contraseña nueva" lead="Elige una que no uses en ningún otro sitio." />
      <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="flex flex-col gap-5">
        {formError ? <FieldError message={formError} /> : null}
        <PasswordField label="Contraseña nueva" name="password" value={password} onChange={setPassword} placeholder="Crea una contraseña" autoComplete="new-password" showStrength error={errors.password} />
        <PasswordField label="Repite la contraseña" name="confirm" value={confirm} onChange={setConfirm} placeholder="Escríbela otra vez" autoComplete="new-password" error={errors.confirm} />
        <SubmitButton submitting={submitting} busyLabel="Guardando">
          Guardar contraseña
        </SubmitButton>
        <Link href="/ingresar" className={`${TEXT_LINK} self-start`}>
          Cancelar
        </Link>
      </form>
    </div>
  );
}

export { ResetForm };
