"use client";

import Link from "next/link";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { AuthHeading } from "../shared/auth-heading";
import { StatusPanel } from "../shared/status-panel";
import { TEXT_LINK } from "../shared/styles";
import { validateEmail } from "../shared/validation";
import { SubmitButton } from "./submit-button";

/**
 * Recuperar contraseña. La respuesta es siempre la misma, exista o no el correo:
 * nunca se confirma que una cuenta existe. El enlace vence en 15 minutos y se
 * usa una sola vez.
 */
function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const found = validateEmail(email);
    setError(found);
    setFormError(null);
    if (found) return;

    setSubmitting(true);
    try {
      const trimmed = email.trim();
      await apiRequest("/api/v1/auth/forgot-password", { method: "POST", body: { email: trimmed } });
      setSentTo(trimmed);
    } catch (caught) {
      const failure = classifyError(caught);
      if (failure.fieldErrors.email) setError(failure.fieldErrors.email);
      else setFormError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <StatusPanel
        icon={EnvelopeSimple}
        title="Revisa tu correo"
        actions={
          <Link href="/ingresar" className={TEXT_LINK}>
            Volver a ingresar
          </Link>
        }
      >
        <p>
          Si <span className="font-medium text-foreground">{sentTo}</span> tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Vence en 15 minutos.
        </p>
        <p className="mt-3 text-body-sm text-muted-foreground-strong">¿No lo ves? Revisa spam o vuelve a intentarlo en unos minutos.</p>
      </StatusPanel>
    );
  }

  return (
    <div>
      <AuthHeading title="Recuperar contraseña" lead="Escribe el correo de tu cuenta y te enviamos un enlace para crear una nueva." />
      <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="flex flex-col gap-5">
        {formError ? <FieldError message={formError} /> : null}
        <Input
          label="Correo"
          name="email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(undefined);
          }}
          placeholder="maria.lopez@correo.mx"
          autoComplete="email"
          error={error}
        />
        <SubmitButton submitting={submitting} busyLabel="Enviando">
          Enviar enlace
        </SubmitButton>
        <Link href="/ingresar" className={`${TEXT_LINK} self-start`}>
          Volver a ingresar
        </Link>
      </form>
    </div>
  );
}

export { ForgotForm };
