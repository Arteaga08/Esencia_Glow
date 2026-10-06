"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AccountDto, AccountProfile } from "@esencia-glow/shared";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { accountRequest } from "@/lib/storefront/account-api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { mapPasswordChangeFailure } from "../shared/form-failures";
import { describeMissing } from "../shared/password";
import { PasswordField } from "../shared/password-field";
import { CTA_DISABLED, CTA_PRIMARY, CTA_SECONDARY } from "../shared/styles";
import { compact, validateName } from "../shared/validation";

interface ProfileFormProps {
  profile: AccountProfile;
  onSaved: (profile: AccountProfile) => void;
  onCancel: () => void;
}

function validateProfile(firstName: string, lastName: string, phone: string) {
  return compact({
    firstName: validateName(firstName, "Falta tu nombre."),
    lastName: validateName(lastName, "Falta tu apellido."),
    phone: phone.length > 0 && phone.length !== 10 ? "Escribe los 10 dígitos de tu celular, sin espacios ni guiones." : undefined,
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Edición de los datos personales. Teléfono, nacimiento y ciudad son opcionales: aquí se capturan, nunca en el alta. */
function ProfileForm({ profile, onSaved, onCancel }: ProfileFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const found = validateProfile(firstName, lastName, phone);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const result = await accountRequest<AccountDto>("/api/v1/account/profile", {
        method: "PATCH",
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          // Vacío = borrar el dato opcional.
          phone: phone || null,
          birthDate: birthDate || null,
          city: city.trim() || null,
        },
      });
      onSaved(result.data.profile);
      // El saludo de la barra lateral lo pinta el layout del servidor.
      router.refresh();
    } catch (caught) {
      const failure = classifyError(caught);
      if (Object.keys(failure.fieldErrors).length > 0) setErrors(failure.fieldErrors);
      else setFormError(failure.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={saving} className="flex flex-col gap-5">
      {formError ? <FieldError message={formError} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Nombre" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="María Fernanda" autoComplete="given-name" error={errors.firstName} />
        <Input label="Apellido" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="López Martínez" autoComplete="family-name" error={errors.lastName} />
      </div>
      <Input label="Correo" value={profile.email} readOnly helper="Es tu acceso a la tienda y no se puede cambiar." />
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
        <Input label="Fecha de nacimiento (opcional)" type="date" value={birthDate} max={todayIso()} onChange={(event) => setBirthDate(event.target.value)} autoComplete="bday" error={errors.birthDate} />
      </div>
      <Input label="Ciudad (opcional)" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Guadalajara" autoComplete="address-level2" error={errors.city} />
      <div className="flex flex-wrap gap-3">
        {saving ? (
          <span className={CTA_DISABLED}>Guardando…</span>
        ) : (
          <button type="submit" className={CTA_PRIMARY}>
            Guardar cambios
          </button>
        )}
        <button type="button" onClick={onCancel} className={CTA_SECONDARY}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function validatePasswords(current: string, next: string, confirm: string) {
  return compact({
    current: current.length === 0 ? "Escribe tu contraseña actual." : undefined,
    next: describeMissing(next),
    confirm: confirm.length === 0 ? "Repite tu contraseña nueva." : confirm !== next ? "Las contraseñas no coinciden." : undefined,
  });
}

interface ChangePasswordFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

/** Cambio de contraseña: pide la actual, aplica la misma regla del alta y avisa que cierra las demás sesiones. */
function ChangePasswordForm({ onSaved, onCancel }: ChangePasswordFormProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const found = validatePasswords(current, next, confirm);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      // Un 401 con `code` es "la actual está mal"; uno sin `code` es sesión vencida y
      // `accountRequest` ya refrescó y reintentó (sin perder lo escrito en el formulario).
      await accountRequest("/api/v1/auth/password", {
        method: "PATCH",
        body: { currentPassword: current, newPassword: next },
      });
      onSaved();
    } catch (caught) {
      const mapped = mapPasswordChangeFailure(classifyError(caught));
      setErrors(mapped.errors);
      setFormError(mapped.formError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={saving} className="flex max-w-md flex-col gap-5">
      {formError ? <FieldError message={formError} /> : null}
      <PasswordField label="Contraseña actual" value={current} onChange={setCurrent} placeholder="Tu contraseña de hoy" autoComplete="current-password" error={errors.current} />
      <PasswordField label="Contraseña nueva" value={next} onChange={setNext} placeholder="Crea una contraseña" autoComplete="new-password" showStrength error={errors.next} />
      <PasswordField label="Repite la contraseña nueva" value={confirm} onChange={setConfirm} placeholder="Escríbela otra vez" autoComplete="new-password" error={errors.confirm} />
      <p className="text-body-sm text-muted-foreground-strong">Al cambiarla cerraremos tu sesión en tus otros dispositivos.</p>
      <div className="flex flex-wrap gap-3">
        {saving ? (
          <span className={CTA_DISABLED}>Guardando…</span>
        ) : (
          <button type="submit" className={CTA_PRIMARY}>
            Guardar contraseña
          </button>
        )}
        <button type="button" onClick={onCancel} className={CTA_SECONDARY}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export { ProfileForm, ChangePasswordForm };
