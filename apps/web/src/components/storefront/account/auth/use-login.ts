"use client";

import { useState, type FormEvent } from "react";
import { UserRole, type LoginOutcome } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { clearAnonymous } from "@/lib/storefront/session-hint";
import { mapLoginFailure } from "../shared/form-failures";
import { compact, validateEmail } from "../shared/validation";

type LoginView = "form" | "unverified" | "staff";

function validate(email: string, password: string) {
  return compact({
    email: validateEmail(email),
    password: password.length === 0 ? "Falta tu contraseña." : undefined,
  });
}

/**
 * Lógica del ingreso de clientas, compartida por `/ingresar` y el paso de cuenta
 * del checkout (cada uno con su propio marcado). `onSignedIn` decide a dónde ir
 * al entrar bien: la página redirige, el checkout solo refresca la sesión.
 */
function useLogin(onSignedIn: () => void, initialEmail = "") {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [view, setView] = useState<LoginView>("form");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const found = validate(email, password);
    setErrors(found);
    setFormError(null);
    setView("form");
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
      if (result.data.next !== "session" || result.data.user.role !== UserRole.CUSTOMER) {
        setView("staff");
        return;
      }

      clearAnonymous();
      onSignedIn();
    } catch (caught) {
      const mapped = mapLoginFailure(classifyError(caught));
      if (mapped.kind === "unverified") setView("unverified");
      else setFormError(mapped.message);
    } finally {
      setSubmitting(false);
    }
  }

  return { email, setEmail, password, setPassword, errors, formError, view, setView, submitting, submit };
}

export { useLogin };
export type { LoginView };
