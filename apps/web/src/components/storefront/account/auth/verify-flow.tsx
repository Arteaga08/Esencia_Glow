"use client";

import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { FieldError } from "@/components/ui/field-error";
import { AuthHeading } from "../shared/auth-heading";
import { PasswordField } from "../shared/password-field";
import { StatusPanel } from "../shared/status-panel";
import { CTA_PRIMARY, TEXT_LINK } from "../shared/styles";
import { InvalidLinkPanel } from "./invalid-link-panel";
import { ResendForm } from "./resend-form";
import { SubmitButton } from "./submit-button";

type Step = "form" | "done" | "invalid";

/**
 * Llegada del enlace del correo: pide la contraseña con la que se creó la
 * cuenta. Es lo que impide que alguien registre el correo ajeno y aproveche que
 * la dueña abra el enlace (ella no conoce esa contraseña). Una contraseña mal
 * escrita NO gasta el enlace (el API responde 401 sin consumirlo).
 */
function VerifyFlow({ token }: { token: string | null }) {
  const [step, setStep] = useState<Step>(token ? "form" : "invalid");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !token) return;
    if (password.length === 0) {
      setError("Falta tu contraseña.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await apiRequest("/api/v1/auth/verify-email", { method: "POST", body: { token, password } });
      setStep("done");
    } catch (caught) {
      const failure = classifyError(caught);
      if (failure.kind === "unauthorized") setError("Esa no es la contraseña de tu cuenta. Revísala e inténtalo de nuevo.");
      else if (failure.kind === "invalid" && Object.keys(failure.fieldErrors).length > 0) setError(failure.fieldErrors.password ?? failure.message);
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
        title="Cuenta verificada"
        actions={
          <Link href="/ingresar" className={CTA_PRIMARY}>
            Ingresar
          </Link>
        }
      >
        <p>Tu correo quedó confirmado. Ya puedes entrar con tu contraseña.</p>
      </StatusPanel>
    );
  }

  if (step === "invalid") {
    return (
      <InvalidLinkPanel actions={null}>
        <p>Los enlaces de verificación duran 24 horas y se usan una sola vez. Pide uno nuevo y ábrelo desde el correo más reciente.</p>
        <div className="mt-5">
          <ResendForm />
        </div>
      </InvalidLinkPanel>
    );
  }

  return (
    <div>
      <AuthHeading title="Activa tu cuenta" lead="Escribe la contraseña con la que creaste tu cuenta para confirmar que eres tú." />
      <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="flex flex-col gap-5">
        {formError ? <FieldError message={formError} /> : null}
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
        <SubmitButton submitting={submitting} busyLabel="Activando">
          Activar mi cuenta
        </SubmitButton>
        <Link href="/recuperar-contrasena" className={`${TEXT_LINK} self-start`}>
          No la recuerdo, quiero crear otra
        </Link>
      </form>
    </div>
  );
}

export { VerifyFlow };
