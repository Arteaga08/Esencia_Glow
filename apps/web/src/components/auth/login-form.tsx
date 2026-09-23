"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiRequestError, apiRequest } from "../../lib/api";
import { Destello } from "../shell/destello";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface CredentialsResult {
  twoFactorRequired?: boolean;
}

/**
 * Login en dos pasos: correo+contraseña, y si la cuenta tiene 2FA activo
 * (auth.service.ts:125), un segundo paso de código de 6 dígitos contra
 * `POST /auth/login/2fa`. La cookie `pending_2fa_token` ya la dejó el primer
 * paso — el front nunca la toca directamente.
 */
function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "twoFactor">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCredentialsSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const result = await apiRequest<CredentialsResult>("/api/v1/auth/login", {
        method: "POST",
        authenticated: true,
        body: { email, password },
      });

      if (result.data.twoFactorRequired) {
        setStep("twoFactor");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setFormError(error instanceof ApiRequestError ? error.message : "Ocurrió un error inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTwoFactorSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await apiRequest("/api/v1/auth/login/2fa", {
        method: "POST",
        authenticated: true,
        body: { code },
      });
      router.replace("/");
      router.refresh();
    } catch (error) {
      setFormError(error instanceof ApiRequestError ? error.message : "Ocurrió un error inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex items-center justify-center gap-2">
        <Destello size={24} />
        <span className="text-display text-foreground">Esencia Glow</span>
      </div>

      {step === "credentials" ? (
        <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-5" noValidate>
          <h2 className="text-section-title text-foreground">Iniciar sesión</h2>
          <Input
            label="Correo"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {formError ? <p className="text-body-sm text-destructive-action">{formError}</p> : null}
          <Button type="submit" loading={submitting} className="w-full">
            Entrar
          </Button>
        </form>
      ) : (
        <form onSubmit={handleTwoFactorSubmit} className="flex flex-col gap-5" noValidate>
          <h2 className="text-section-title text-foreground">Verificación en dos pasos</h2>
          <p className="text-body-sm text-muted-foreground-strong">
            Ingresa el código de 6 dígitos de tu app de autenticación.
          </p>
          <Input
            label="Código"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
          {formError ? <p className="text-body-sm text-destructive-action">{formError}</p> : null}
          <Button type="submit" loading={submitting} className="w-full">
            Verificar
          </Button>
        </form>
      )}
    </div>
  );
}

export { LoginForm };
