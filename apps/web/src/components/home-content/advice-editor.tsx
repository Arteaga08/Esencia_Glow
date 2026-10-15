"use client";

import { useEffect, useMemo, useState } from "react";
import { HOME_CONTENT_LIMITS, type AdminHomeAdvice } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { saveAdvice } from "./advice-actions";
import { fingerprint, hasImage, toFormValue, validate, type AdviceFormValue } from "./advice-form-value";
import { EditorSurface } from "./editor-surface";
import { HeroImageSlot } from "./hero-image-slot";

const DESCRIPTION =
  "Foto en arco con una palabra grande encima y, al lado, el texto con un botón que abre el WhatsApp de asesoría.";

function describe(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

interface AdviceEditorProps {
  section: AdminHomeAdvice;
  onSaved: (section: AdminHomeAdvice) => void;
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Editor del bloque de asesoría del home: etiqueta, título, texto, palabra del
 * arco, texto del botón y una foto vertical, con un solo Guardar. El botón no
 * tiene enlace editable: siempre abre el WhatsApp de asesoría de la tienda. Un
 * 409 significa que otra persona editó el bloque: se avisa y no se pisa nada.
 */
function AdviceEditor({ section, onSaved, embedded = false, onDirtyChange }: AdviceEditorProps) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(section);
  const [value, setValue] = useState<AdviceFormValue>(() => toFormValue(section));
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

  function setText(field: Exclude<keyof AdviceFormValue, "isActive" | "image">, text: string) {
    setValue((current) => ({ ...current, [field]: text }));
  }

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
      const result = await saveAdvice(value, saved.version);
      setSaved(result.section);
      setValue(result.value);
      if (!result.imageError) setBaseline(fingerprint(result.value));
      onSaved(result.section);
      if (result.imageError) {
        const message = describe(result.imageError, "No se pudo subir la foto.");
        setFormError(`El texto se guardó, pero la foto no: ${message} Vuelve a darle Guardar para reintentar.`);
        toast({ variant: "error", title: "Falló la subida de la foto", description: message });
      } else {
        toast({ variant: "success", title: "Bloque de asesoría guardado" });
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        setFormError(
          "Alguien más editó este bloque mientras trabajabas. Recarga la página para ver sus cambios; no se guardó nada tuyo.",
        );
      } else {
        setApiErrors(error instanceof ApiRequestError ? (error.fieldErrors ?? {}) : {});
        setFormError(describe(error, "No se pudo guardar el bloque."));
      }
      toast({ variant: "error", title: "No se guardó el bloque", description: describe(error, "Intenta de nuevo.") });
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
              <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Asesoría</p>
              <p className="mt-1 max-w-[70ch] text-body-sm text-muted-foreground">{DESCRIPTION}</p>
            </div>
            <Badge color={dirty ? "warning" : "success"}>{dirty ? "Cambios sin guardar" : "Guardado"}</Badge>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Switch
            checked={value.isActive}
            onChange={(isActive) => setValue((c) => ({ ...c, isActive }))}
            label="Mostrar el bloque de asesoría en la tienda"
          />
          <span className="text-body text-foreground">Mostrar este bloque en la tienda</span>
        </div>

        <div className="grid gap-5 md:grid-cols-[3fr_2fr]">
          <div className="flex flex-col gap-4">
            <Input
              label="Etiqueta sobre el título (opcional)"
              placeholder="Asesoría personalizada"
              maxLength={HOME_CONTENT_LIMITS.adviceEyebrowMax}
              value={value.eyebrow}
              onChange={(event) => setText("eyebrow", event.target.value)}
              error={errors.eyebrow}
            />
            <Input
              label="Título"
              placeholder="Tu rutina, armada contigo"
              maxLength={HOME_CONTENT_LIMITS.adviceTitleMax}
              value={value.title}
              onChange={(event) => setText("title", event.target.value)}
              error={errors.title}
            />
            <Textarea
              label="Texto"
              placeholder="Cuéntanos cómo es tu piel y qué quieres lograr. Te decimos qué productos sí te sirven y en qué orden usarlos."
              rows={3}
              maxLength={HOME_CONTENT_LIMITS.subtitleMax}
              value={value.body}
              onChange={(event) => setText("body", event.target.value)}
              error={errors.body}
            />
            <Input
              label="Palabra grande sobre la foto (opcional)"
              placeholder="Asesoría"
              maxLength={HOME_CONTENT_LIMITS.adviceWordMax}
              value={value.archWord}
              onChange={(event) => setText("archWord", event.target.value)}
              error={errors.archWord}
            />
            <Input
              label="Texto del botón"
              placeholder="Pedir asesoría"
              maxLength={HOME_CONTENT_LIMITS.ctaLabelMax}
              value={value.ctaLabel}
              onChange={(event) => setText("ctaLabel", event.target.value)}
              error={errors.ctaLabel}
            />
            <p className="text-body-sm text-muted-foreground">
              El botón abre el WhatsApp de asesoría con un mensaje ya escrito.
            </p>
          </div>
          <div className="max-w-xs">
            <HeroImageSlot
              label="Foto"
              dimensions="1080 × 1440 px · vertical 3:4"
              aspectClassName="aspect-[3/4] rounded-t-full"
              draft={value.image}
              onChange={(image) => setValue((c) => ({ ...c, image }))}
            />
          </div>
        </div>

        {!hasImage(value) ? <FieldError message="Sin foto este bloque no se publica en la tienda." /> : null}

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

export { AdviceEditor };
