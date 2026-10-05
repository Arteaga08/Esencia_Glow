"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import type { AccountData } from "./fixture";
import { describeMissing } from "./password";
import { PasswordField } from "./password-field";
import { CTA_PRIMARY, CTA_SECONDARY } from "./styles";
import { compact, validateName } from "./validation";

interface ProfileFormProps {
  user: AccountData["user"];
  /** Parte del estado `error`: arranca con datos inválidos para mostrar los avisos. */
  withErrors: boolean;
  saveHref: string;
  cancelHref: string;
}

function validateProfile(firstName: string, lastName: string, phone: string) {
  return compact({
    firstName: validateName(firstName, "Falta tu nombre."),
    lastName: validateName(lastName, "Falta tu apellido."),
    phone: phone.length > 0 && phone.length !== 10 ? "Escribe los 10 dígitos de tu celular, sin espacios ni guiones." : undefined,
  });
}

/** Edición de los datos personales. Teléfono, nacimiento y ciudad son opcionales: aquí se capturan, nunca en el alta. */
function ProfileForm({ user, withErrors, saveHref, cancelHref }: ProfileFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(withErrors ? "" : user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(withErrors ? "331234" : user.phone);
  const [birthDate, setBirthDate] = useState(user.birthDate);
  const [city, setCity] = useState(user.city);
  const [errors, setErrors] = useState<Record<string, string>>(() =>
    withErrors ? validateProfile("", user.lastName, "331234") : {},
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateProfile(firstName, lastName, phone);
    setErrors(found);
    if (Object.keys(found).length === 0) router.push(saveHref);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Nombre" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="María Fernanda" autoComplete="given-name" error={errors.firstName} />
        <Input label="Apellido" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="López Martínez" autoComplete="family-name" error={errors.lastName} />
      </div>
      <Input label="Correo" value={user.email} readOnly helper="Es tu acceso a la tienda y no se puede cambiar." />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Celular (opcional)"
          value={phone}
          onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
          placeholder="3312345678"
          inputMode="numeric"
          maxLength={10}
          autoComplete="tel-national"
          error={errors.phone}
        />
        <Input label="Fecha de nacimiento (opcional)" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} autoComplete="bday" />
      </div>
      <Input label="Ciudad (opcional)" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Guadalajara" autoComplete="address-level2" />
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={CTA_PRIMARY}>
          Guardar cambios
        </button>
        <Link href={cancelHref} className={CTA_SECONDARY}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

interface ChangePasswordFormProps {
  saveHref: string;
  cancelHref: string;
}

function validatePasswords(current: string, next: string, confirm: string) {
  return compact({
    current: current.length === 0 ? "Escribe tu contraseña actual." : undefined,
    next: describeMissing(next),
    confirm: confirm.length === 0 ? "Repite tu contraseña nueva." : confirm !== next ? "Las contraseñas no coinciden." : undefined,
  });
}

/** Cambio de contraseña: pide la actual, aplica la misma regla del alta y avisa que cierra las demás sesiones. */
function ChangePasswordForm({ saveHref, cancelHref }: ChangePasswordFormProps) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validatePasswords(current, next, confirm);
    setErrors(found);
    if (Object.keys(found).length === 0) router.push(saveHref);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-md flex-col gap-5">
      <PasswordField label="Contraseña actual" value={current} onChange={setCurrent} placeholder="Tu contraseña de hoy" autoComplete="current-password" error={errors.current} />
      <PasswordField label="Contraseña nueva" value={next} onChange={setNext} placeholder="Crea una contraseña" autoComplete="new-password" showStrength error={errors.next} />
      <PasswordField label="Repite la contraseña nueva" value={confirm} onChange={setConfirm} placeholder="Escríbela otra vez" autoComplete="new-password" error={errors.confirm} />
      <p className="text-body-sm text-muted-foreground-strong">Al cambiarla cerraremos tu sesión en tus otros dispositivos.</p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={CTA_PRIMARY}>
          Guardar contraseña
        </button>
        <Link href={cancelHref} className={CTA_SECONDARY}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export { ProfileForm, ChangePasswordForm };
