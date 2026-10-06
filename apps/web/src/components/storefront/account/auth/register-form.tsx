"use client";

import Link from "next/link";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { AuthHeading } from "../shared/auth-heading";
import { CheckboxField } from "../shared/checkbox-field";
import { describeMissing } from "../shared/password";
import { PasswordField } from "../shared/password-field";
import { CTA_SECONDARY } from "../shared/styles";
import { compact, validateEmail, validateName } from "../shared/validation";
import { SubmitButton } from "./submit-button";

interface RegisterFormProps {
  loginHref: string;
  /** Registro aceptado (el API responde igual exista o no el correo). */
  onRegistered: (email: string) => void;
}

interface Values {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
  terms: boolean;
}

const EMPTY: Values = { firstName: "", lastName: "", email: "", password: "", confirm: "", terms: false };
const LINK_CLASS = "underline decoration-border-strong underline-offset-4 hover:decoration-foreground";

function validate(values: Values) {
  return compact({
    firstName: validateName(values.firstName, "Falta tu nombre."),
    lastName: validateName(values.lastName, "Falta tu apellido."),
    email: validateEmail(values.email),
    password: describeMissing(values.password),
    confirm: values.confirm.length === 0 ? "Repite tu contraseña." : values.confirm !== values.password ? "Las contraseñas no coinciden." : undefined,
    terms: values.terms ? undefined : "Acepta los Términos y el Aviso de privacidad para crear tu cuenta.",
  });
}

/**
 * Alta de clienta: solo lo indispensable (nombre, apellido, correo, contraseña
 * con confirmación y aceptar términos). Todo lo demás se captura después, en
 * Mi cuenta.
 */
function RegisterForm({ loginHref, onRegistered }: RegisterFormProps) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    // El error de un campo se retira apenas se vuelve a tocar.
    setErrors((current) => {
      if (!current[key]) return current;
      const rest = { ...current };
      delete rest[key];
      return rest;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const found = validate(values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const email = values.email.trim();
      await apiRequest("/api/v1/auth/register", {
        method: "POST",
        body: { email, password: values.password, firstName: values.firstName.trim(), lastName: values.lastName.trim() },
      });
      onRegistered(email);
    } catch (caught) {
      const failure = classifyError(caught);
      // Los errores por campo del API van pegados a su campo (contraseña filtrada, correo largo…).
      if (Object.keys(failure.fieldErrors).length > 0) setErrors(failure.fieldErrors);
      else if (failure.kind === "invalid" && /contraseña/i.test(failure.message)) setErrors({ password: failure.message });
      else setFormError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <AuthHeading title="Crear cuenta" lead="Con tu cuenta compras más rápido y sigues tus pedidos y tu caja." />
      <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="flex flex-col gap-5">
        {formError ? <FieldError message={formError} /> : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Nombre" name="firstName" value={values.firstName} onChange={(event) => set("firstName", event.target.value)} placeholder="María" autoComplete="given-name" error={errors.firstName} />
          <Input label="Apellido" name="lastName" value={values.lastName} onChange={(event) => set("lastName", event.target.value)} placeholder="López" autoComplete="family-name" error={errors.lastName} />
        </div>
        <Input label="Correo" name="email" type="email" value={values.email} onChange={(event) => set("email", event.target.value)} placeholder="maria.lopez@correo.mx" autoComplete="email" error={errors.email} />
        <PasswordField label="Contraseña" name="password" value={values.password} onChange={(value) => set("password", value)} placeholder="Crea una contraseña" autoComplete="new-password" showStrength error={errors.password} />
        <PasswordField label="Repite la contraseña" name="confirm" value={values.confirm} onChange={(value) => set("confirm", value)} placeholder="Escríbela otra vez" autoComplete="new-password" error={errors.confirm} />
        <CheckboxField checked={values.terms} onChange={(checked) => set("terms", checked)} error={errors.terms}>
          Acepto los{" "}
          <Link href="/terminos" target="_blank" className={LINK_CLASS}>
            Términos
          </Link>{" "}
          y el{" "}
          <Link href="/privacidad" target="_blank" className={LINK_CLASS}>
            Aviso de privacidad
          </Link>
          .
        </CheckboxField>

        <div className="flex flex-col gap-3">
          <SubmitButton submitting={submitting} busyLabel="Creando tu cuenta">
            Crear cuenta
          </SubmitButton>
          <p className="flex items-start gap-2 text-body-sm text-muted-foreground-strong">
            <EnvelopeSimple size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            Te enviaremos un correo para activar tu cuenta. Al abrirlo escribirás esta misma contraseña para confirmar que eres tú.
          </p>
        </div>
      </form>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border-strong pt-6">
        <p className="text-body text-foreground/80">¿Ya tienes cuenta?</p>
        <Link href={loginHref} className={CTA_SECONDARY}>
          Ingresar
        </Link>
      </div>
    </div>
  );
}

export { RegisterForm };
