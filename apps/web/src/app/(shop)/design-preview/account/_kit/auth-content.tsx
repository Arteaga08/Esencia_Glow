import { CheckEmail } from "./check-email";
import { ForgotForm } from "./forgot-form";
import { LoginForm } from "./login-form";
import { previewHref } from "./preview-state";
import { RegisterForm } from "./register-form";
import { ResetForm } from "./reset-form";
import type { AuthView } from "./types";
import { VerifyResult } from "./verify-result";

interface AuthContentProps {
  view: AuthView;
  state: string | null;
  /** Ruta de la propuesta, p. ej. `/design-preview/account/a`. */
  base: string;
  /** Correo de ejemplo de las pantallas que lo mencionan. */
  email: string;
  headingClass?: string;
  /** Falso en C: ahí entrar y crear cuenta se cambian con pestañas, no con enlaces. */
  showSwitchLinks?: boolean;
}

/**
 * Cuerpo de cada pantalla de acceso, sin marco: la propuesta lo coloca en su
 * propia composición (mitad de página, columna angosta o tarjeta).
 */
function AuthContent({ view, state, base, email, headingClass, showSwitchLinks = true }: AuthContentProps) {
  const login = previewHref(base, "ingresar");

  switch (view) {
    case "ingresar":
      return (
        <LoginForm
          state={state}
          headingClass={headingClass}
          nextHref={previewHref(base, "inicio")}
          registerHref={previewHref(base, "crear")}
          forgotHref={previewHref(base, "recuperar")}
          resendHref={previewHref(base, "correo")}
          showRegisterLink={showSwitchLinks}
        />
      );
    case "crear":
      return <RegisterForm state={state} headingClass={headingClass} verifyHref={previewHref(base, "correo")} loginHref={login} showLoginLink={showSwitchLinks} />;
    case "correo":
      return (
        <CheckEmail
          state={state}
          email={email}
          headingClass={headingClass}
          resendHref={previewHref(base, "correo", "reenviado")}
          changeHref={previewHref(base, "crear")}
          openLinkHref={previewHref(base, "verificar")}
        />
      );
    case "verificar":
      return <VerifyResult state={state} headingClass={headingClass} loginHref={login} resendHref={previewHref(base, "correo")} doneHref={previewHref(base, "verificar", "listo")} forgotHref={previewHref(base, "recuperar")} />;
    case "recuperar":
      return <ForgotForm state={state} headingClass={headingClass} loginHref={login} sentHref={previewHref(base, "recuperar", "enviado")} resetHref={previewHref(base, "restablecer")} />;
    case "restablecer":
      return <ResetForm state={state} headingClass={headingClass} loginHref={login} forgotHref={previewHref(base, "recuperar")} doneHref={previewHref(base, "restablecer", "listo")} />;
  }
}

export { AuthContent };
