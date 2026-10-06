"use client";

import Link from "next/link";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { AuthHeading } from "../shared/auth-heading";
import { CheckboxField } from "../shared/checkbox-field";
import { PasswordField } from "../shared/password-field";
import { CTA_SECONDARY } from "../shared/styles";
import { SubmitButton } from "./submit-button";
import { useRegister } from "./use-register";

interface RegisterFormProps {
  loginHref: string;
  /** Registro aceptado (el API responde igual exista o no el correo). */
  onRegistered: (email: string) => void;
}

const LINK_CLASS = "underline decoration-border-strong underline-offset-4 hover:decoration-foreground";

/**
 * Alta de clienta: solo lo indispensable (nombre, apellido, correo, contraseña
 * con confirmación y aceptar términos). Todo lo demás se captura después, en
 * Mi cuenta.
 */
function RegisterForm({ loginHref, onRegistered }: RegisterFormProps) {
  const { values, set, errors, formError, submitting, submit } = useRegister(onRegistered);

  return (
    <div>
      <AuthHeading title="Crear cuenta" lead="Con tu cuenta compras más rápido y sigues tus pedidos y tu caja." />
      <form onSubmit={submit} noValidate aria-busy={submitting} className="flex flex-col gap-5">
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
