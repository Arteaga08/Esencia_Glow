"use client";

import { useEffect, useState } from "react";
import type { AdminHomePageCovers, HomePageCoverKey } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { useToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { EditorSurface } from "./editor-surface";
import { HeroImageSlot } from "./hero-image-slot";
import { savePageCovers } from "./page-covers-actions";
import { PAGE_COVERS, fingerprint, toFormValue, type PageCoversFormValue } from "./page-covers-form-value";

const DESCRIPTION =
  "Foto del encabezado de las páginas de Más vendidos y Kits de la tienda. Sin foto, el encabezado queda en rosa liso.";

function describe(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

interface PageCoversEditorProps {
  section: AdminHomePageCovers;
  onSaved: (section: AdminHomePageCovers) => void;
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Editor de las fotos de encabezado de las páginas de Más vendidos y Kits:
 * una foto por página, con un solo Guardar. No es un bloque del home (no tiene
 * interruptor): la foto se publica con solo existir. Un 409 significa que otra
 * persona editó las fotos: se avisa y no se pisa nada.
 */
function PageCoversEditor({ section, onSaved, embedded = false, onDirtyChange }: PageCoversEditorProps) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(section);
  const [value, setValue] = useState<PageCoversFormValue>(() => toFormValue(section));
  const [baseline, setBaseline] = useState(() => fingerprint(toFormValue(section)));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = fingerprint(value) !== baseline;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function setImage(key: HomePageCoverKey, draft: PageCoversFormValue[HomePageCoverKey]) {
    setValue((current) => ({ ...current, [key]: draft }));
  }

  function handleDiscard() {
    setValue(toFormValue(saved));
    setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const result = await savePageCovers(value, saved);
    setSaved(result.section);
    setValue(result.value);
    onSaved(result.section);
    if (!result.imageError) {
      setBaseline(fingerprint(result.value));
      toast({ variant: "success", title: "Fotos de encabezado guardadas" });
    } else if (result.imageError instanceof ApiRequestError && result.imageError.status === 409) {
      setFormError(
        "Alguien más editó estas fotos mientras trabajabas. Recarga la página para ver sus cambios y vuelve a intentarlo.",
      );
      toast({ variant: "error", title: "No se guardaron las fotos", description: "Alguien más las editó." });
    } else {
      const message = describe(result.imageError, "No se pudo subir una de las fotos.");
      setFormError(`Una foto no se guardó: ${message} Vuelve a darle Guardar para reintentar.`);
      toast({ variant: "error", title: "Falló la subida de una foto", description: message });
    }
    setSaving(false);
  }

  return (
    <EditorSurface embedded={embedded}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        {embedded ? (
          <p className="max-w-[70ch] text-body-sm text-muted-foreground">{DESCRIPTION}</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
                Portadas de páginas
              </p>
              <p className="mt-1 max-w-[70ch] text-body-sm text-muted-foreground">{DESCRIPTION}</p>
            </div>
            <Badge color={dirty ? "warning" : "success"}>{dirty ? "Cambios sin guardar" : "Guardado"}</Badge>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {PAGE_COVERS.map(({ key, label }) => (
            <HeroImageSlot
              key={key}
              label={`Página de ${label}`}
              dimensions="1920 × 640 px · horizontal"
              aspectClassName="aspect-[3/1]"
              draft={value[key]}
              onChange={(draft) => setImage(key, draft)}
            />
          ))}
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

export { PageCoversEditor };
