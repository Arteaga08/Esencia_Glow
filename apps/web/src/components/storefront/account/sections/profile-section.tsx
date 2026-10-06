"use client";

import { useState } from "react";
import type { AccountProfile } from "@esencia-glow/shared";
import { formatCompactDate, formatPhone } from "../shared/dates";
import { Block, DataList, Notice } from "../shared/frame";
import { ROW_ACTION } from "../shared/styles";
import { ChangePasswordForm, ProfileForm } from "./profile-forms";

type Editing = "none" | "profile" | "password";

/** Perfil y contraseña: lectura con "Editar", formulario en la misma tarjeta, error en línea y aviso de guardado. */
function ProfileSection({ initial }: { initial: AccountProfile }) {
  const [profile, setProfile] = useState(initial);
  const [editing, setEditing] = useState<Editing>("none");
  const [notice, setNotice] = useState<string | null>(null);

  function finish(message: string) {
    setEditing("none");
    setNotice(message);
  }

  return (
    <div className="flex flex-col gap-6">
      {notice ? <Notice>{notice}</Notice> : null}

      <Block
        title="Datos personales"
        action={
          editing === "profile" ? undefined : (
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setEditing("profile");
              }}
              className={ROW_ACTION}
            >
              Editar
            </button>
          )
        }
      >
        {editing === "profile" ? (
          <ProfileForm
            profile={profile}
            onSaved={(saved) => {
              setProfile(saved);
              finish("Guardamos tus cambios.");
            }}
            onCancel={() => setEditing("none")}
          />
        ) : (
          <DataList
            rows={[
              { label: "Nombre", value: profile.firstName },
              { label: "Apellido", value: profile.lastName },
              { label: "Correo", value: profile.email },
              { label: "Celular", value: profile.phone ? formatPhone(profile.phone) : null },
              { label: "Nacimiento", value: profile.birthDate ? formatCompactDate(`${profile.birthDate}T12:00:00Z`) : null },
              { label: "Ciudad", value: profile.city },
            ]}
          />
        )}
      </Block>

      <Block
        title="Contraseña"
        action={
          editing === "password" ? undefined : (
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setEditing("password");
              }}
              className={ROW_ACTION}
            >
              Cambiar
            </button>
          )
        }
      >
        {editing === "password" ? (
          <ChangePasswordForm onSaved={() => finish("Cambiamos tu contraseña y cerramos tus otras sesiones.")} onCancel={() => setEditing("none")} />
        ) : (
          <p className="text-body text-foreground/80">Elige una contraseña que no uses en ningún otro sitio.</p>
        )}
      </Block>
    </div>
  );
}

export { ProfileSection };
