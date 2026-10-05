"use client";

import Link from "next/link";
import { useState } from "react";
import { Envelope } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { CTA_PRIMARY, CTA_SECONDARY, TEXT_LINK } from "./cta-styles";

type AccountMode = "login" | "register" | "verify" | "session";

interface AccountStepProps {
  /** `?estado=` de la vista: `nueva`, `verificar` o `sesion`; sin él, entrar. */
  state: string | null;
  email: string;
  firstName: string;
  /** Siguiente paso (envío) cuando ya hay sesión. */
  nextHref: string;
  /** Destino al crear la cuenta: la pantalla "revisa tu correo". */
  verifyHref: string;
}

const TABS = [
  { id: "login", label: "Ya tengo cuenta" },
  { id: "register", label: "Soy nueva" },
];

function initialMode(state: string | null): AccountMode {
  if (state === "nueva") return "register";
  if (state === "verificar") return "verify";
  if (state === "sesion") return "session";
  return "login";
}

/**
 * Paso de cuenta del checkout (la compra exige cuenta). Cuatro caras: entrar,
 * crear cuenta, "revisa tu correo" (el registro no deja entrar hasta verificar)
 * y sesión ya iniciada. Los botones navegan entre vistas de la vista previa.
 */
function AccountStep({ state, email, firstName, nextHref, verifyHref }: AccountStepProps) {
  const [mode, setMode] = useState<AccountMode>(() => initialMode(state));

  if (mode === "session") {
    return (
      <div className="flex flex-col items-start gap-4">
        <div>
          <p className="text-subtitle text-foreground">Compras como {firstName}</p>
          <p className="text-body-sm text-muted-foreground-strong">{email}</p>
        </div>
        <Link href={nextHref} className={CTA_PRIMARY}>
          Continuar al envío
        </Link>
        <button type="button" onClick={() => setMode("login")} className={TEXT_LINK}>
          No soy {firstName}
        </button>
      </div>
    );
  }

  if (mode === "verify") {
    return (
      <div className="flex max-w-[52ch] flex-col items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-md bg-muted text-foreground">
          <Envelope size={24} aria-hidden="true" />
        </span>
        <div role="status">
          <p className="text-subtitle text-foreground">Revisa tu correo</p>
          <p className="mt-1 text-body text-foreground/80">
            Enviamos un enlace a <span className="font-medium">{email}</span>. Ábrelo para activar tu cuenta y regresa: tu carrito te espera tal como lo dejaste.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <button type="button" className={CTA_SECONDARY}>
            Reenviar enlace
          </button>
          <button type="button" onClick={() => setMode("register")} className={TEXT_LINK}>
            Usar otro correo
          </button>
        </div>
      </div>
    );
  }

  const isRegister = mode === "register";

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Tabs items={TABS} activeId={mode} onChange={(id) => setMode(id as AccountMode)} ariaLabel="Entrar o crear cuenta" />
      {isRegister ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nombre" placeholder="María" autoComplete="given-name" />
          <Input label="Apellido" placeholder="López" autoComplete="family-name" />
        </div>
      ) : null}
      <Input label="Correo" type="email" placeholder="maria.lopez@correo.mx" autoComplete="email" />
      <Input
        label="Contraseña"
        type="password"
        placeholder={isRegister ? "Crea una contraseña" : "Tu contraseña"}
        autoComplete={isRegister ? "new-password" : "current-password"}
        helper={isRegister ? "Mínimo 10 caracteres, con mayúscula, minúscula y número." : undefined}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href={isRegister ? verifyHref : nextHref} className={CTA_PRIMARY}>
          {isRegister ? "Crear cuenta" : "Entrar y continuar"}
        </Link>
        {isRegister ? null : (
          <Link href="#" className={TEXT_LINK}>
            Olvidé mi contraseña
          </Link>
        )}
      </div>
    </div>
  );
}

export { AccountStep };
