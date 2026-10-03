"use client";

import { useMemo, useState } from "react";
import type { AdminHomeSpotlight } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import type { HeroImageSlot as Slot } from "./hero-form-value";
import { HeroImageSlot } from "./hero-image-slot";
import { saveSpotlight } from "./spotlight-actions";
import {
  fingerprint,
  hasDesktopImage,
  toFormValue,
  validate,
  type SpotlightFormValue,
  type SpotlightMeta,
} from "./spotlight-form-value";

function describe(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

interface SpotlightEditorProps {
  meta: SpotlightMeta;
  section: AdminHomeSpotlight;
  onSaved: (section: AdminHomeSpotlight) => void;
}

/**
 * Editor de la portada de Novedades o Kits (bloque 5 del home): título,
 * subtítulo y dos fotos (escritorio y móvil), con un solo Guardar. Las
 * tarjetas no se editan aquí: salen del catálogo. Un 409 significa que otra
 * persona editó el bloque: se avisa y no se pisa nada.
 */
function SpotlightEditor({ meta, section, onSaved }: SpotlightEditorProps) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(section);
  const [value, setValue] = useState<SpotlightFormValue>(() => toFormValue(section, meta));
  const [baseline, setBaseline] = useState(() => fingerprint(toFormValue(section, meta)));
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = fingerprint(value) !== baseline;
  const formatErrors = useMemo(() => validate(value), [value]);
  const errors = { ...apiErrors, ...(showErrors ? formatErrors : {}) };

  function setImage(slot: Slot, draft: SpotlightFormValue["images"][Slot]) {
    setValue((current) => ({ ...current, images: { ...current.images, [slot]: draft } }));
  }

  function handleDiscard() {
    setValue(toFormValue(saved, meta));
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
      const result = await saveSpotlight(meta, value, saved.version);
      setSaved(result.section);
      setValue(result.value);
      if (!result.imageError) setBaseline(fingerprint(result.value));
      onSaved(result.section);
      if (result.imageError) {
        const message = describe(result.imageError, "No se pudo subir una de las fotos.");
        setFormError(`El texto se guardó, pero una foto no: ${message} Vuelve a darle Guardar para reintentar.`);
        toast({ variant: "error", title: "Falló la subida de una foto", description: message });
      } else {
        toast({ variant: "success", title: `${meta.defaultTitle} guardado` });
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
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
              {meta.label}
            </p>
            <p className="mt-1 max-w-[70ch] text-body-sm text-muted-foreground">{meta.cardsHint}</p>
          </div>
          <Badge color={dirty ? "warning" : "success"}>{dirty ? "Cambios sin guardar" : "Guardado"}</Badge>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={value.isActive}
            onChange={(isActive) => setValue((c) => ({ ...c, isActive }))}
            label={`Mostrar ${meta.defaultTitle} en la tienda`}
          />
          <span className="text-body text-foreground">Mostrar este bloque en la tienda</span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Input
              label="Título"
              placeholder={meta.titlePlaceholder}
              value={value.title}
              onChange={(event) => setValue((c) => ({ ...c, title: event.target.value }))}
              error={errors.title}
            />
            <Input
              label="Subtítulo (opcional)"
              placeholder={meta.subtitlePlaceholder}
              value={value.subtitle}
              onChange={(event) => setValue((c) => ({ ...c, subtitle: event.target.value }))}
              error={errors.subtitle}
            />
          </div>
          <div className="grid grid-cols-[4fr_3fr] items-start gap-4">
            <HeroImageSlot
              label="Escritorio"
              dimensions="1200 × 1500 px · vertical 4:5"
              aspectClassName="aspect-[4/5]"
              draft={value.images.desktop}
              onChange={(draft) => setImage("desktop", draft)}
            />
            <HeroImageSlot
              label="Móvil"
              dimensions="1080 × 1440 px · vertical 3:4"
              aspectClassName="aspect-[3/4]"
              draft={value.images.mobile}
              onChange={(draft) => setImage("mobile", draft)}
            />
          </div>
        </div>

        {!hasDesktopImage(value) ? (
          <FieldError message="Sin foto de escritorio este bloque no se publica en la tienda." />
        ) : null}
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
    </Card>
  );
}

export { SpotlightEditor };
