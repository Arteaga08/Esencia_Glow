"use client";

import { WarningCircle } from "@phosphor-icons/react";
import type { LoginOutcome, TwoFactorEnrollment } from "@esencia-glow/shared";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiRequestError, apiRequest } from "../../lib/api";
import { Destello } from "../shell/destello";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const NETWORK_ERROR = "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.";
const UNEXPECTED_ERROR = "Algo salió mal de nuestro lado. Intenta de nuevo en un momento.";

/**
 * Un solo texto para cualquier credencial que no entra, y ningún campo
 * marcado en rojo: si el correo mal escrito diera un error distinto al de la
 * contraseña equivocada, la pantalla estaría diciendo qué correos existen en
 * la base. Por eso el 400 (el correo no tiene forma de correo) y el 401 (no
 * coinciden) comparten mensaje — a quien de verdad se equivocó tecleando le
 * sirve igual, y a quien tantea cuentas no le sirve de nada.
 */
const CREDENTIALS_ERROR = "Correo o contraseña incorrectos.";

function credentialsErrorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return NETWORK_ERROR;
  if (error.status === 400 || error.status === 401) return CREDENTIALS_ERROR;
  if (error.status >= 500) return UNEXPECTED_ERROR;
  // 403 (falta verificar el correo) y 429 (demasiados intentos) ya llegan con
  // un texto que le dice a la persona qué hacer — se muestran tal cual.
  return error.message;
}

function twoFactorErrorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return NETWORK_ERROR;
  if (error.status === 400) return "El código debe tener 6 dígitos.";
  if (error.status >= 500) return UNEXPECTED_ERROR;
  return error.message;
}

/**
 * Error que abarca al formulario entero (credenciales malas, 2FA inválido).
 * Mismo tratamiento que el error de campo de `Input` — ícono `WarningCircle`
 * de 16px en `destructive-action` (DESIGN.md §5) — y `role="alert"` para que
 * un lector de pantalla lo anuncie al aparecer, ya que nada mueve el foco.
 */
function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-body-sm text-destructive-action">
      <WarningCircle size={16} weight="regular" className="mt-0.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

/**
 * Login con hasta tres pasos, según lo que devuelva `LoginOutcome.next`
 * (packages/shared/src/types/auth.ts) tras correo+contraseña:
 * - `"session"`: entra directo.
 * - `"twoFactor"`: la cuenta ya tiene 2FA activo (auth.service.ts) — pide el
 *   código de 6 dígitos contra `POST /auth/login/2fa`.
 * - `"twoFactorSetup"`: es un admin sin 2FA — el enrolamiento es obligatorio
 *   (BACKEND_SECURITY_GUIDELINES.md §2), así que en vez de sesión se le pide
 *   escanear un QR y confirmar un código antes de entrar, contra
 *   `POST /auth/login/2fa/setup` + `/login/2fa/enroll`.
 * En los tres casos la cookie `pending_2fa_token` la pone/borra el backend —
 * el front nunca la toca directamente.
 */
function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "twoFactor" | "twoFactorSetup">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<TwoFactorEnrollment | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCredentialsSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const result = await apiRequest<LoginOutcome>("/api/v1/auth/login", {
        method: "POST",
        authenticated: true,
        body: { email, password },
      });

      if (result.data.next === "session") {
        router.replace("/");
        router.refresh();
        return;
      }

      if (result.data.next === "twoFactor") {
        setStep("twoFactor");
        return;
      }

      // next === "twoFactorSetup": ya hay pending token de enrolamiento, se
      // pide el QR de una vez para no obligar a un segundo clic.
      try {
        const setup = await apiRequest<TwoFactorEnrollment>("/api/v1/auth/login/2fa/setup", {
          method: "POST",
          authenticated: true,
        });
        setEnrollment(setup.data);
        setStep("twoFactorSetup");
      } catch {
        setFormError(UNEXPECTED_ERROR);
      }
    } catch (error) {
      setFormError(credentialsErrorMessage(error));
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
      setFormError(twoFactorErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTwoFactorSetupSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await apiRequest("/api/v1/auth/login/2fa/enroll", {
        method: "POST",
        authenticated: true,
        body: { code },
      });
      router.replace("/");
      router.refresh();
    } catch (error) {
      setFormError(twoFactorErrorMessage(error));
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
          <h2 className="text-section-title text-center text-foreground">Iniciar sesión</h2>
          <Input
            label="Correo"
            type="email"
            placeholder="nombre@esenciaglow.com"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Contraseña"
            type="password"
            placeholder="Tu contraseña"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {formError ? <FormError message={formError} /> : null}
          <Button type="submit" loading={submitting} className="w-full cursor-pointer">
            Entrar
          </Button>
        </form>
      ) : null}

      {step === "twoFactor" ? (
        <form onSubmit={handleTwoFactorSubmit} className="flex flex-col gap-5" noValidate>
          <h2 className="text-section-title text-center text-foreground">
            Verificación en dos pasos
          </h2>
          <p className="text-center text-body-sm text-muted-foreground-strong">
            Ingresa el código de 6 dígitos de tu app de autenticación.
          </p>
          <Input
            label="Código"
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
          {formError ? <FormError message={formError} /> : null}
          <Button type="submit" loading={submitting} className="w-full">
            Verificar
          </Button>
        </form>
      ) : null}

      {step === "twoFactorSetup" && enrollment ? (
        <form onSubmit={handleTwoFactorSetupSubmit} className="flex flex-col gap-5" noValidate>
          <h2 className="text-section-title text-center text-foreground">
            Activa la verificación en dos pasos
          </h2>
          <p className="text-center text-body-sm text-muted-foreground-strong">
            Tu cuenta de administrador requiere un segundo factor. Escanea este código con tu app de
            autenticación (Google Authenticator, Authy, 1Password…).
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- el QR llega
              como data URL ya generado por el backend; next/image no aporta
              nada sobre una imagen que nunca se sirve desde una URL propia. */}
          <img
            src={enrollment.qrCodeDataUrl}
            alt="Código QR para activar la verificación en dos pasos"
            width={200}
            height={200}
            className="mx-auto rounded-md border border-border-strong"
          />
          <div className="rounded-md border border-border-strong bg-muted/40 p-3 text-center">
            <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
              ¿No puedes escanear?
            </p>
            <p className="mt-1 select-all break-all font-mono text-body-sm text-foreground">
              {enrollment.manualEntryKey}
            </p>
          </div>
          <Input
            label="Código"
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
          {formError ? <FormError message={formError} /> : null}
          <Button type="submit" loading={submitting} className="w-full">
            Activar y entrar
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export { LoginForm };
