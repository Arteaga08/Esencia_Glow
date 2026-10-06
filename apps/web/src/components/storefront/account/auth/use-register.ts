"use client";

import { useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { describeMissing } from "../shared/password";
import { compact, validateEmail, validateName } from "../shared/validation";

interface RegisterValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
  terms: boolean;
}

const EMPTY: RegisterValues = { firstName: "", lastName: "", email: "", password: "", confirm: "", terms: false };

function validate(values: RegisterValues) {
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
 * Lógica del alta de clientas, compartida por `/crear-cuenta` y el paso de
 * cuenta del checkout. El registro NO inicia sesión: `onRegistered` recibe el
 * correo para mostrar "revisa tu correo".
 */
function useRegister(onRegistered: (email: string) => void) {
  const [values, setValues] = useState<RegisterValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof RegisterValues>(key: K, value: RegisterValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    // El error de un campo se retira apenas se vuelve a tocar.
    setErrors((current) => {
      if (!current[key]) return current;
      const rest = { ...current };
      delete rest[key];
      return rest;
    });
  }

  async function submit(event: FormEvent) {
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

  return { values, set, errors, formError, submitting, submit };
}

export { useRegister };
export type { RegisterValues };
