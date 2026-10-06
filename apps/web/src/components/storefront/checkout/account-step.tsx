"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { UnverifiedNotice } from "@/components/storefront/account/auth/unverified-notice";
import { StaffAccountNotice } from "@/components/storefront/account/auth/staff-account-notice";
import { useLogin } from "@/components/storefront/account/auth/use-login";
import { useRegister } from "@/components/storefront/account/auth/use-register";
import { formatCountdown, useResendVerification } from "@/components/storefront/account/auth/use-resend-verification";
import { CheckboxField } from "@/components/storefront/account/shared/checkbox-field";
import { PasswordField } from "@/components/storefront/account/shared/password-field";
import { CTA_DISABLED, CTA_PRIMARY, CTA_SECONDARY, TEXT_LINK } from "../cart/cta-styles";

type Mode = "login" | "register";

const TABS = [
  { id: "login", label: "Ya tengo cuenta" },
  { id: "register", label: "Soy nueva" },
];

const LINK_CLASS = "underline decoration-border-strong underline-offset-4 hover:decoration-foreground";

/** "Revisa tu correo": el registro no deja entrar hasta verificar. Al volver, el carrito sigue en el navegador. */
function CheckEmail({ email, onUseOther, onVerified }: { email: string; onUseOther: () => void; onVerified: () => void }) {
  const { status, error, secondsLeft, resend } = useResendVerification(email, true);
  const cooling = secondsLeft > 0 || status === "sending";

  return (
    <div className="flex max-w-[52ch] flex-col items-start gap-4">
      <span className="flex size-12 items-center justify-center rounded-md bg-muted text-foreground">
        <EnvelopeSimple size={24} aria-hidden="true" />
      </span>
      <div role="status">
        <p className="text-subtitle text-foreground">Revisa tu correo</p>
        <p className="mt-1 text-body text-foreground/80">
          Enviamos un enlace a <span className="font-medium">{email}</span>. Ábrelo, escribe tu contraseña para activar tu cuenta y regresa: tu carrito te espera tal como lo dejaste.
        </p>
        {status === "sent" ? <p className="mt-2 font-medium text-secondary-foreground">Listo, pedimos un enlace nuevo. El anterior ya no sirve.</p> : null}
        {error ? <p role="alert" className="mt-2 text-destructive-action">{error}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <button type="button" onClick={onVerified} className={CTA_PRIMARY}>
          Ya la activé, entrar
        </button>
        {cooling ? (
          <span className={CTA_DISABLED} aria-disabled="true">
            {status === "sending" ? "Enviando…" : `Reenviar en ${formatCountdown(secondsLeft)}`}
          </span>
        ) : (
          <button type="button" onClick={resend} className={CTA_SECONDARY}>
            Reenviar enlace
          </button>
        )}
        <button type="button" onClick={onUseOther} className={TEXT_LINK}>
          Usar otro correo
        </button>
      </div>
    </div>
  );
}

function LoginPane({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  // Entrar bien solo refresca la sesión del servidor: la clienta no sale del checkout.
  const login = useLogin(() => router.refresh(), initialEmail);

  if (login.view === "staff") return <StaffAccountNotice onBack={() => login.setView("form")} />;

  return (
    <form onSubmit={login.submit} noValidate aria-busy={login.submitting} className="flex flex-col gap-5">
      {login.formError ? <FieldError message={login.formError} /> : null}
      {login.view === "unverified" ? <UnverifiedNotice email={login.email.trim()} /> : null}
      <Input label="Correo" name="email" type="email" value={login.email} onChange={(event) => login.setEmail(event.target.value)} placeholder="maria.lopez@correo.mx" autoComplete="email" error={login.errors.email} />
      <PasswordField label="Contraseña" name="password" value={login.password} onChange={login.setPassword} placeholder="Tu contraseña" autoComplete="current-password" error={login.errors.password} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {login.submitting ? (
          <span className={CTA_DISABLED} role="status">
            Entrando…
          </span>
        ) : (
          <button type="submit" className={CTA_PRIMARY}>
            Entrar y continuar
          </button>
        )}
        <Link href="/recuperar-contrasena" className={TEXT_LINK}>
          Olvidé mi contraseña
        </Link>
      </div>
    </form>
  );
}

function RegisterPane({ onRegistered }: { onRegistered: (email: string) => void }) {
  const { values, set, errors, formError, submitting, submit } = useRegister(onRegistered);

  return (
    <form onSubmit={submit} noValidate aria-busy={submitting} className="flex flex-col gap-5">
      {formError ? <FieldError message={formError} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
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
      {submitting ? (
        <span className={`${CTA_DISABLED} self-start`} role="status">
          Creando tu cuenta…
        </span>
      ) : (
        <button type="submit" className={`${CTA_PRIMARY} self-start`}>
          Crear cuenta
        </button>
      )}
    </form>
  );
}

/**
 * Paso de cuenta del checkout (la compra exige cuenta). Tres caras: entrar,
 * crear cuenta y "revisa tu correo" (el registro no deja entrar hasta verificar).
 * Entrar refresca la sesión sin salir de la página; el carrito vive en el
 * navegador, así que sigue intacto aunque la clienta salga a verificar su correo.
 */
function AccountStep() {
  const [mode, setMode] = useState<Mode>("login");
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Tras verificar, el correo con el que se registró llega puesto al formulario de ingreso.
  const [loginEmail, setLoginEmail] = useState("");

  if (sentTo) {
    return (
      <CheckEmail
        email={sentTo}
        onUseOther={() => setSentTo(null)}
        onVerified={() => {
          setLoginEmail(sentTo);
          setSentTo(null);
          setMode("login");
        }}
      />
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Tabs items={TABS} activeId={mode} onChange={(id) => setMode(id as Mode)} ariaLabel="Entrar o crear cuenta" />
      {mode === "login" ? <LoginPane initialEmail={loginEmail} /> : <RegisterPane onRegistered={setSentTo} />}
    </div>
  );
}

export { AccountStep };
