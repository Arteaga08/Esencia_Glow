"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { AuthHeading } from "../shared/auth-heading";
import { PasswordField } from "../shared/password-field";
import { CTA_SECONDARY, TEXT_LINK } from "../shared/styles";
import { StaffAccountNotice } from "./staff-account-notice";
import { SubmitButton } from "./submit-button";
import { useLogin } from "./use-login";
import { UnverifiedNotice } from "./unverified-notice";

interface LoginFormProps {
  /** Destino al entrar bien, ya validado en el servidor con `resolveRedirect`. */
  redirectTo: string;
  /** Enlaces a las otras pantallas conservan el `?redirect=` para no perder a dónde iba. */
  registerHref: string;
}

/** Formulario de ingreso de clientas. */
function LoginForm({ redirectTo, registerHref }: LoginFormProps) {
  const router = useRouter();
  const { email, setEmail, password, setPassword, errors, formError, view, setView, submitting, submit } = useLogin(() => {
    router.replace(redirectTo);
    router.refresh();
  });

  if (view === "staff") return <StaffAccountNotice onBack={() => setView("form")} />;

  return (
    <div>
      <AuthHeading title="Ingresar" lead="Entra para ver tus pedidos, tu suscripción y tus direcciones." />
      <form onSubmit={submit} noValidate aria-busy={submitting} className="flex flex-col gap-5">
        {formError ? <FieldError message={formError} /> : null}
        {view === "unverified" ? <UnverifiedNotice email={email.trim()} /> : null}

        <Input
          label="Correo"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="maria.lopez@correo.mx"
          autoComplete="email"
          error={errors.email}
        />
        <PasswordField label="Contraseña" name="password" value={password} onChange={setPassword} placeholder="Tu contraseña" autoComplete="current-password" error={errors.password} />

        <div className="flex flex-col gap-3">
          <SubmitButton submitting={submitting} busyLabel="Entrando">
            Entrar
          </SubmitButton>
          <Link href="/recuperar-contrasena" className={`${TEXT_LINK} self-start`}>
            Olvidé mi contraseña
          </Link>
        </div>
      </form>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border-strong pt-6">
        <p className="text-body text-foreground/80">¿Primera vez en Esencia Glow?</p>
        <Link href={registerHref} className={CTA_SECONDARY}>
          Crear cuenta
        </Link>
      </div>
    </div>
  );
}

export { LoginForm };
