"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SpinnerGap } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { AuthHeading } from "./auth-heading";
import { PasswordField } from "./password-field";
import { CTA_DISABLED, CTA_PRIMARY, CTA_SECONDARY, TEXT_LINK } from "./styles";
import { compact, validateEmail } from "./validation";

interface LoginFormProps {
  /** `?estado=` de la vista: vacío, incorrecto, sinverificar, limite o enviando. */
  state: string | null;
  headingClass?: string;
  /** Destino al entrar bien (Mi cuenta). */
  nextHref: string;
  registerHref: string;
  forgotHref: string;
  /** Pantalla "revisa tu correo", a la que lleva reenviar el enlace. */
  resendHref: string;
  /** En C el cambio entre entrar y crear vive en las pestañas, no en un enlace. */
  showRegisterLink?: boolean;
}

const SEED_EMAIL = "maria.lopez@correo.mx";

function seedFor(state: string | null) {
  if (state === "incorrecto" || state === "sinverificar" || state === "limite" || state === "enviando") {
    return { email: SEED_EMAIL, password: "Glow2026!" };
  }
  return { email: "", password: "" };
}

function validate(email: string, password: string) {
  return compact({
    email: validateEmail(email),
    password: password.length === 0 ? "Falta tu contraseña." : undefined,
  });
}

/**
 * Formulario de ingreso. El error de credenciales es siempre el mismo texto
 * genérico (anti-enumeración): nunca dice si el correo existe. Solo quien ya
 * acertó la contraseña se entera de que su cuenta falta verificar.
 */
function LoginForm({ state, headingClass, nextHref, registerHref, forgotHref, resendHref, showRegisterLink = true }: LoginFormProps) {
  const router = useRouter();
  const seed = seedFor(state);
  const [email, setEmail] = useState(seed.email);
  const [password, setPassword] = useState(seed.password);
  const [errors, setErrors] = useState<Record<string, string>>(() => (state === "vacio" ? validate("", "") : {}));
  const submitting = state === "enviando";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate(email, password);
    setErrors(found);
    if (Object.keys(found).length === 0) router.push(nextHref);
  }

  return (
    <div>
      <AuthHeading title="Ingresar" lead="Entra para ver tus pedidos, tu suscripción y tus direcciones." headingClass={headingClass} />
      <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="flex flex-col gap-5">
        {state === "incorrecto" ? <FieldError message="Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo." /> : null}
        {state === "limite" ? <FieldError message="Hiciste demasiados intentos. Espera 15 minutos o recupera tu contraseña." /> : null}
        {state === "sinverificar" ? (
          <div role="alert" className="rounded-md bg-accent px-4 py-3 text-body-sm text-accent-foreground-strong">
            <p className="font-medium">Todavía no verificas tu correo.</p>
            <p className="mt-0.5">Abre el enlace que te enviamos al crear tu cuenta, o pide uno nuevo.</p>
            <Link href={resendHref} className={`${TEXT_LINK} !text-accent-foreground-strong`}>
              Enviar el enlace otra vez
            </Link>
          </div>
        ) : null}

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
          {submitting ? (
            <span className={`${CTA_DISABLED} w-full`}>
              <SpinnerGap size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Entrando
            </span>
          ) : (
            <button type="submit" className={`${CTA_PRIMARY} w-full`}>
              Entrar
            </button>
          )}
          <Link href={forgotHref} className={`${TEXT_LINK} self-start`}>
            Olvidé mi contraseña
          </Link>
        </div>
      </form>

      {showRegisterLink ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border-strong pt-6">
          <p className="text-body text-foreground/80">¿Primera vez en Esencia Glow?</p>
          <Link href={registerHref} className={CTA_SECONDARY}>
            Crear cuenta
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export { LoginForm };
