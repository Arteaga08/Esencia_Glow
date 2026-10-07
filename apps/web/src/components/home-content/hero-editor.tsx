"use client";

import { useEffect, useMemo, useState } from "react";
import { HOME_CONTENT_LIMITS, type AdminHomeHero } from "@esencia-glow/shared";
import { Plus } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { FieldError } from "@/components/ui/field-error";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { EditorSurface } from "./editor-surface";
import { scopeErrors } from "@/lib/field-errors";
import { saveHero } from "./hero-actions";
import {
  emptySlide,
  fingerprint,
  toFormValue,
  validateSlide,
  type HeroFormValue,
  type HeroSlideDraft,
} from "./hero-form-value";
import { HeroSlideFields } from "./hero-slide-fields";

const MAX_SLIDES = HOME_CONTENT_LIMITS.maxHeroSlides;

function describe(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

/**
 * Editor del hero del home (Milestone 3.1.2): hasta 3 slides con título,
 * subtítulo, enlace y dos fotos (escritorio y móvil), y un solo Guardar.
 * El guardado encadena contenido + fotos (ver `saveHero`). Un 409 significa
 * que otra persona editó el hero: se avisa y no se pisa nada.
 */
function HeroEditor({
  hero,
  onSaved,
  embedded = false,
  onDirtyChange,
}: {
  hero: AdminHomeHero;
  onSaved: (hero: AdminHomeHero) => void;
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(hero);
  const [value, setValue] = useState<HeroFormValue>(() => toFormValue(hero));
  const [baseline, setBaseline] = useState(() => fingerprint(toFormValue(hero)));
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const dirty = fingerprint(value) !== baseline;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const slideErrors = useMemo(() => value.slides.map(validateSlide), [value.slides]);
  const hasFormatErrors = slideErrors.some((errors) => Object.keys(errors).length > 0);

  function patchSlide(key: string, patch: Partial<HeroSlideDraft>) {
    setValue((current) => ({
      ...current,
      slides: current.slides.map((slide) => (slide.key === key ? { ...slide, ...patch } : slide)),
    }));
  }

  function adopt(next: HeroFormValue, hero: AdminHomeHero, fullySaved: boolean) {
    setSaved(hero);
    setValue(next);
    if (fullySaved) setBaseline(fingerprint(next));
    onSaved(hero);
  }

  function handleDiscard() {
    setValue(toFormValue(saved));
    setApiErrors({});
    setFormError(null);
    setShowErrors(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (hasFormatErrors) return setShowErrors(true);
    setSaving(true);
    setApiErrors({});
    setFormError(null);
    try {
      const result = await saveHero(value, saved.version);
      adopt(result.value, result.hero, !result.imageError);
      if (result.imageError) {
        const message = describe(result.imageError, "No se pudo subir una de las fotos.");
        setFormError(
          `El texto se guardó, pero una foto no: ${message} Vuelve a darle Guardar para reintentar.`,
        );
        toast({ variant: "error", title: "Falló la subida de una foto", description: message });
      } else {
        toast({ variant: "success", title: "Hero guardado" });
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        setFormError(
          "Alguien más editó el hero mientras trabajabas. Recarga la página para ver sus cambios; no se guardó nada tuyo.",
        );
      } else {
        setApiErrors(error instanceof ApiRequestError ? (error.fieldErrors ?? {}) : {});
        setFormError(describe(error, "No se pudo guardar el hero."));
      }
      toast({
        variant: "error",
        title: "No se guardó el hero",
        description: describe(error, "Intenta de nuevo."),
      });
    } finally {
      setSaving(false);
    }
  }

  function confirmRemoval() {
    setValue((current) => ({
      ...current,
      slides: current.slides.filter((slide) => slide.key !== pendingRemoval),
    }));
    setPendingRemoval(null);
  }

  return (
    <EditorSurface embedded={embedded}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        {embedded ? null : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
                Hero del home
              </p>
              <p className="mt-1 text-body-sm text-muted-foreground">
                La portada de la tienda. Hasta {MAX_SLIDES} slides que cambian solos cada 6 segundos.
              </p>
            </div>
            <Badge color={dirty ? "warning" : "success"}>
              {dirty ? "Cambios sin guardar" : "Guardado"}
            </Badge>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Switch
            checked={value.isActive}
            onChange={(isActive) => setValue((c) => ({ ...c, isActive }))}
            label="Mostrar el hero en la tienda"
          />
          <span className="text-body text-foreground">Mostrar el hero en la tienda</span>
        </div>

        <div className="flex flex-col gap-5">
          {value.slides.map((slide, position) => (
            <HeroSlideFields
              key={slide.key}
              slide={slide}
              position={position}
              errors={{
                ...scopeErrors(apiErrors, `slides.${position}.`),
                ...(showErrors ? slideErrors[position] : {}),
              }}
              onChange={(patch) => patchSlide(slide.key, patch)}
              onRemove={() => setPendingRemoval(slide.key)}
            />
          ))}
          {value.slides.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">
              Todavía no hay slides. Agrega el primero.
            </p>
          ) : null}
        </div>

        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setValue((c) => ({ ...c, slides: [...c.slides, emptySlide()] }))}
            disabled={value.slides.length >= MAX_SLIDES}
          >
            <Plus size={16} aria-hidden="true" /> Agregar slide
          </Button>
          {value.slides.length >= MAX_SLIDES ? (
            <p className="mt-2 text-body-sm text-muted-foreground">Máximo {MAX_SLIDES} slides.</p>
          ) : null}
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

      <ConfirmModal
        open={pendingRemoval !== null}
        title="Eliminar slide"
        confirmLabel="Eliminar"
        variant="destructive"
        loading={false}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={confirmRemoval}
      >
        <p className="text-body text-foreground">
          El slide y sus fotos se quitan al guardar. Mientras no guardes, puedes recuperarlo con
          Descartar.
        </p>
      </ConfirmModal>
    </EditorSurface>
  );
}

export { HeroEditor };
