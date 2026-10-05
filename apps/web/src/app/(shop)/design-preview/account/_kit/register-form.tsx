"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EnvelopeSimple, SpinnerGap } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { AuthHeading } from "./auth-heading";
import { CheckboxField } from "./checkbox-field";
import { describeMissing } from "./password";
import { PasswordField } from "./password-field";
import { CTA_DISABLED, CTA_PRIMARY, CTA_SECONDARY } from "./styles";
import { compact, validateEmail, validateName } from "./validation";

interface RegisterFormProps {
  /** `?estado=` de la vista: errores, debil, nocoincide, terminos o enviando. */
  state: string | null;
  headingClass?: string;
  /** Destino al crear la cuenta: "revisa tu correo". */
  verifyHref: string;
  loginHref: string;
  /** En C el cambio entre entrar y crear vive en las pestañas, no en un enlace. */
  showLoginLink?: boolean;
}

interface Values {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
  terms: boolean;
}

const EMPTY: Values = { firstName: "", lastName: "", email: "", password: "", confirm: "", terms: false };
const VALID: Values = { firstName: "María", lastName: "López", email: "maria.lopez@correo.mx", password: "GlowRosa2026", confirm: "GlowRosa2026", terms: true };

/** Datos de partida de cada estado de la vista previa; con `base` el formulario arranca vacío. */
function seedFor(state: string | null): Values {
  switch (state) {
    case "errores":
      return { ...EMPTY, email: "maria.lopez@correo" };
    case "debil":
      return { ...VALID, password: "hola2026", confirm: "hola2026" };
    case "nocoincide":
      return { ...VALID, confirm: "GlowRosa202" };
    case "terminos":
      return { ...VALID, terms: false };
    case "enviando":
      return VALID;
    default:
      return EMPTY;
  }
}

function validate(values: Values) {
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
 * Alta de cliente: solo lo indispensable (nombre, apellido, correo,
 * contraseña con confirmación y aceptar términos). Todo lo demás se captura
 * después, en Mi cuenta. El registro no inicia sesión: manda a verificar el
 * correo.
 */
function RegisterForm({ state, headingClass, verifyHref, loginHref, showLoginLink = true }: RegisterFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => seedFor(state));
  const [errors, setErrors] = useState<Record<string, string>>(() => (state && state !== "enviando" ? validate(seedFor(state)) : {}));
  const submitting = state === "enviando";

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    // El error de un campo se retira apenas se vuelve a tocar.
    setErrors((current) => {
      if (!current[key]) return current;
      const rest = { ...current };
      delete rest[key];
      return rest;
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length === 0) router.push(verifyHref);
  }

  return (
    <div>
      <AuthHeading title="Crear cuenta" lead="Con tu cuenta compras más rápido y sigues tus pedidos y tu caja." headingClass={headingClass} />
      <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Nombre" name="firstName" value={values.firstName} onChange={(event) => set("firstName", event.target.value)} placeholder="María" autoComplete="given-name" error={errors.firstName} />
          <Input label="Apellido" name="lastName" value={values.lastName} onChange={(event) => set("lastName", event.target.value)} placeholder="López" autoComplete="family-name" error={errors.lastName} />
        </div>
        <Input label="Correo" name="email" type="email" value={values.email} onChange={(event) => set("email", event.target.value)} placeholder="maria.lopez@correo.mx" autoComplete="email" error={errors.email} />
        <PasswordField label="Contraseña" name="password" value={values.password} onChange={(value) => set("password", value)} placeholder="Crea una contraseña" autoComplete="new-password" showStrength error={errors.password} />
        <PasswordField label="Repite la contraseña" name="confirm" value={values.confirm} onChange={(value) => set("confirm", value)} placeholder="Escríbela otra vez" autoComplete="new-password" error={errors.confirm} />
        <CheckboxField checked={values.terms} onChange={(checked) => set("terms", checked)} error={errors.terms}>
          Acepto los{" "}
          <Link href="#" className="underline decoration-border-strong underline-offset-4 hover:decoration-foreground">
            Términos
          </Link>{" "}
          y el{" "}
          <Link href="#" className="underline decoration-border-strong underline-offset-4 hover:decoration-foreground">
            Aviso de privacidad
          </Link>
          .
        </CheckboxField>

        <div className="flex flex-col gap-3">
          {submitting ? (
            <span className={`${CTA_DISABLED} w-full`}>
              <SpinnerGap size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Creando tu cuenta
            </span>
          ) : (
            <button type="submit" className={`${CTA_PRIMARY} w-full`}>
              Crear cuenta
            </button>
          )}
          <p className="flex items-start gap-2 text-body-sm text-muted-foreground-strong">
            <EnvelopeSimple size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            Te enviaremos un correo para activar tu cuenta. Al abrirlo escribirás esta misma contraseña para confirmar que eres tú.
          </p>
        </div>
      </form>

      {showLoginLink ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border-strong pt-6">
          <p className="text-body text-foreground/80">¿Ya tienes cuenta?</p>
          <Link href={loginHref} className={CTA_SECONDARY}>
            Ingresar
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export { RegisterForm };
