"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { AuthHeading } from "./auth-heading";
import { StatusPanel } from "./status-panel";
import { CTA_PRIMARY, CTA_SECONDARY, TEXT_LINK } from "./styles";
import { validateEmail } from "./validation";

interface ForgotFormProps {
  /** `?estado=` de la vista: invalido o enviado. */
  state: string | null;
  headingClass?: string;
  loginHref: string;
  /** Misma pantalla en estado `enviado`: la respuesta es idéntica exista o no la cuenta. */
  sentHref: string;
  /** Pantalla para crear una contraseña nueva (en la vista previa simula abrir el enlace). */
  resetHref: string;
}

/**
 * Recuperar contraseña. La respuesta es siempre la misma, exista o no el
 * correo: nunca se confirma que una cuenta existe. El enlace vence en una hora
 * y se usa una sola vez.
 */
function ForgotForm({ state, headingClass, loginHref, sentHref, resetHref }: ForgotFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(state === "invalido" ? "maria.lopez@" : state === "enviado" ? "maria.lopez@correo.mx" : "");
  const [error, setError] = useState<string | undefined>(() => (state === "invalido" ? validateEmail("maria.lopez@") : undefined));

  if (state === "enviado") {
    return (
      <StatusPanel
        icon={EnvelopeSimple}
        title="Revisa tu correo"
        headingClass={headingClass}
        actions={
          <>
            <Link href={resetHref} className={CTA_SECONDARY}>
              Abrir el enlace
            </Link>
            <Link href={loginHref} className={TEXT_LINK}>
              Volver a ingresar
            </Link>
          </>
        }
      >
        <p>
          Si <span className="font-medium text-foreground">{email}</span> tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Vence en 15 minutos.
        </p>
        <p className="mt-3 text-body-sm text-muted-foreground-strong">¿No lo ves? Revisa spam o vuelve a intentarlo en unos minutos.</p>
      </StatusPanel>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateEmail(email);
    setError(found);
    if (!found) router.push(sentHref);
  }

  return (
    <div>
      <AuthHeading title="Recuperar contraseña" lead="Escribe el correo de tu cuenta y te enviamos un enlace para crear una nueva." headingClass={headingClass} />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Input
          label="Correo"
          name="email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(undefined);
          }}
          placeholder="maria.lopez@correo.mx"
          autoComplete="email"
          error={error}
        />
        <button type="submit" className={`${CTA_PRIMARY} w-full`}>
          Enviar enlace
        </button>
        <Link href={loginHref} className={`${TEXT_LINK} self-start`}>
          Volver a ingresar
        </Link>
      </form>
    </div>
  );
}

export { ForgotForm };
