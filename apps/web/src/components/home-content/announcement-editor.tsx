"use client";

import { useEffect, useMemo, useState } from "react";
import { HOME_CONTENT_LIMITS, type AdminHomeAnnouncement } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { saveAnnouncement } from "./announcement-actions";
import { fingerprint, toFormValue, validate, type AnnouncementFormValue } from "./announcement-form-value";
import { EditorSurface } from "./editor-surface";

function describe(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

interface AnnouncementEditorProps {
  section: AdminHomeAnnouncement;
  onSaved: (section: AdminHomeAnnouncement) => void;
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Editor del aviso que corre arriba del menú en toda la tienda (por ejemplo
 * "Envío gratis en compras de más de $1,599"): la frase, un enlace opcional y
 * si se muestra. Es solo texto, así que no hay fotos. Un 409 significa que otra
 * persona editó el bloque: se avisa y no se pisa nada.
 */
function AnnouncementEditor({ section, onSaved, embedded = false, onDirtyChange }: AnnouncementEditorProps) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(section);
  const [value, setValue] = useState<AnnouncementFormValue>(() => toFormValue(section));
  const [baseline, setBaseline] = useState(() => fingerprint(toFormValue(section)));
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = fingerprint(value) !== baseline;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const formatErrors = useMemo(() => validate(value), [value]);
  const errors = { ...apiErrors, ...(showErrors ? formatErrors : {}) };

  function handleDiscard() {
    setValue(toFormValue(saved));
    setApiErrors({});
    setFormError(null);
    setShowErrors(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (Object.keys(formatErrors).length > 0) return setShowErrors(true);
    setSaving(true);
    setApiErrors({});
    setFormError(null);
    try {
      const result = await saveAnnouncement(value, saved.version);
      const next = toFormValue(result);
      setSaved(result);
      setValue(next);
      setBaseline(fingerprint(next));
      onSaved(result);
      toast({ variant: "success", title: "Aviso guardado" });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        setFormError(
          "Alguien más editó este bloque mientras trabajabas. Recarga la página para ver sus cambios; no se guardó nada tuyo.",
        );
      } else {
        setApiErrors(error instanceof ApiRequestError ? (error.fieldErrors ?? {}) : {});
        setFormError(describe(error, "No se pudo guardar el aviso."));
      }
      toast({ variant: "error", title: "No se guardó el aviso", description: describe(error, "Intenta de nuevo.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorSurface embedded={embedded}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        {embedded ? null : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Aviso</p>
              <p className="mt-1 max-w-[70ch] text-body-sm text-muted-foreground">
                Una cinta con una frase que corre arriba del menú en todas las páginas de la tienda.
              </p>
            </div>
            <Badge color={dirty ? "warning" : "success"}>{dirty ? "Cambios sin guardar" : "Guardado"}</Badge>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Switch
            checked={value.isActive}
            onChange={(isActive) => setValue((c) => ({ ...c, isActive }))}
            label="Mostrar el aviso en la tienda"
          />
          <span className="text-body text-foreground">Mostrar este aviso en la tienda</span>
        </div>

        <div className="flex max-w-xl flex-col gap-4">
          <Input
            label="Frase del aviso"
            placeholder="Envío gratis en compras de más de $1,599"
            maxLength={HOME_CONTENT_LIMITS.announcementTextMax}
            value={value.text}
            onChange={(event) => setValue((c) => ({ ...c, text: event.target.value }))}
            error={errors.text}
          />
          <Input
            label="Enlace (opcional)"
            placeholder="/ofertas"
            maxLength={HOME_CONTENT_LIMITS.hrefMax}
            value={value.href}
            onChange={(event) => setValue((c) => ({ ...c, href: event.target.value }))}
            error={errors.href}
            helper={errors.href ? undefined : "Si lo pones, tocar el aviso lleva a esa página. Déjalo vacío para que sea solo texto."}
          />
        </div>

        {formError ? <FieldError message={formError} /> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saving} disabled={!dirty}>
            Guardar
          </Button>
          <Button type="button" variant="ghost" onClick={handleDiscard} disabled={!dirty || saving}>
            Descartar
          </Button>
        </div>
      </form>
    </EditorSurface>
  );
}

export { AnnouncementEditor };
