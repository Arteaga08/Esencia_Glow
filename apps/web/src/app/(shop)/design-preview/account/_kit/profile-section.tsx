import Link from "next/link";
import { Block, DataList, Notice, type Tone } from "./frame";
import type { AccountData } from "./fixture";
import { ChangePasswordForm, ProfileForm } from "./profile-forms";
import { formatCompactDate, formatPhone } from "./dates";
import { previewHref } from "./preview-state";
import { ROW_ACTION } from "./styles";

interface ProfileSectionProps {
  tone: Tone;
  state: string | null;
  base: string;
  user: AccountData["user"];
}

/** Perfil y contraseña: lectura con "Editar", formulario, error en línea y aviso de guardado. */
function ProfileSection({ tone, state, base, user }: ProfileSectionProps) {
  const profile = previewHref(base, "perfil");
  const saved = previewHref(base, "perfil", "guardado");
  const editing = state === "editando" || state === "error";

  return (
    <div className="flex flex-col gap-6">
      {state === "guardado" ? <Notice>Guardamos tus cambios.</Notice> : null}

      <Block
        tone={tone}
        title="Datos personales"
        action={
          editing ? undefined : (
            <Link href={previewHref(base, "perfil", "editando")} className={ROW_ACTION}>
              Editar
            </Link>
          )
        }
      >
        {editing ? (
          <ProfileForm user={user} withErrors={state === "error"} saveHref={saved} cancelHref={profile} />
        ) : (
          <DataList
            rows={[
              { label: "Nombre", value: user.firstName },
              { label: "Apellido", value: user.lastName },
              { label: "Correo", value: user.email },
              { label: "Celular", value: formatPhone(user.phone) },
              { label: "Nacimiento", value: formatCompactDate(`${user.birthDate}T12:00:00Z`) },
              { label: "Ciudad", value: user.city },
            ]}
          />
        )}
      </Block>

      <Block
        tone={tone}
        title="Contraseña"
        action={
          state === "contrasena" ? undefined : (
            <Link href={previewHref(base, "perfil", "contrasena")} className={ROW_ACTION}>
              Cambiar
            </Link>
          )
        }
      >
        {state === "contrasena" ? (
          <ChangePasswordForm saveHref={saved} cancelHref={profile} />
        ) : (
          <p className="text-body text-foreground/80">Actualizada el {formatCompactDate(user.passwordChangedAt)}.</p>
        )}
      </Block>
    </div>
  );
}

export { ProfileSection };
