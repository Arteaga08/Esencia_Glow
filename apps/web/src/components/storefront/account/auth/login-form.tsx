"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { UserRole, type LoginOutcome } from "@esencia-glow/shared";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { clearAnonymous } from "@/lib/storefront/session-hint";
import { AuthHeading } from "../shared/auth-heading";
import { PasswordField } from "../shared/password-field";
import { CTA_SECONDARY, TEXT_LINK } from "../shared/styles";
import { compact, validateEmail } from "../shared/validation";
import { StaffAccountNotice } from "./staff-account-notice";
import { SubmitButton } from "./submit-button";
import { UnverifiedNotice } from "./unverified-notice";

interface LoginFormProps {
  /** Destino al entrar bien, ya validado en el servidor con `resolveRedirect`. */
  redirectTo: string;
  /** Enlaces a las otras pantallas conservan el `?redirect=` para no perder a dónde iba. */
  registerHref: string;
}

// Un solo texto para cualquier credencial que no entra: nunca dice si el correo
// existe (anti-enumeración). Solo quien ya acertó la contraseña se entera de que
// su cuenta falta verificar.
const CREDENTIALS_ERROR = "Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.";

function validate(email: string, password: string) {
  return compact({
    email: validateEmail(email),
    password: password.length === 0 ? "Falta tu contraseña." : undefined,
  });
}

type Outcome = "form" | "unverified" | "staff";

/** Formulario de ingreso de clientas. */
function LoginForm({ redirectTo, registerHref }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("form");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const found = validate(email, password);
    setErrors(found);
    setFormError(null);
    setOutcome("form");
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const result = await apiRequest<LoginOutcome>("/api/v1/auth/login", {
        method: "POST",
        authenticated: true,
        body: { email: email.trim(), password },
      });

      // Una cuenta del equipo no entra por aquí: el API le pide el segundo factor
      // y el panel tiene su propia pantalla para eso.
      if (result.data.next !== "session") {
        setOutcome("staff");
        return;
      }
      if (result.data.user.role !== UserRole.CUSTOMER) {
        setOutcome("staff");
        return;
      }

      clearAnonymous();
      router.replace(redirectTo);
      router.refresh();
    } catch (caught) {
      const failure = classifyError(caught);
      if (failure.kind === "forbidden") setOutcome("unverified");
      else if (failure.kind === "invalid" || failure.kind === "unauthorized") setFormError(CREDENTIALS_ERROR);
      else setFormError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome === "staff") return <StaffAccountNotice onBack={() => setOutcome("form")} />;

  return (
    <div>
      <AuthHeading title="Ingresar" lead="Entra para ver tus pedidos, tu suscripción y tus direcciones." />
      <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="flex flex-col gap-5">
        {formError ? <FieldError message={formError} /> : null}
        {outcome === "unverified" ? <UnverifiedNotice email={email.trim()} /> : null}

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
