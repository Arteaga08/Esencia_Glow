"use client";

import { useEffect, useMemo, useState } from "react";
import { HOME_CONTENT_LIMITS, type AdminHomeOfferBanner } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { EditorSurface } from "./editor-surface";
import { HeroImageSlot } from "./hero-image-slot";
import { HeroSlideLinkField } from "./hero-slide-link-field";
import { saveOfferBanner } from "./offer-banner-actions";
import {
  fingerprint,
  hasDesktopImage,
  toFormValue,
  validate,
  type OfferBannerFormValue,
  type OfferBannerImageSlot as Slot,
} from "./offer-banner-form-value";

function describe(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

interface OfferBannerEditorProps {
  section: AdminHomeOfferBanner;
  onSaved: (section: AdminHomeOfferBanner) => void;
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Editor del banner de oferta (bloque 8 del home): la frase que corre en bucle
 * sobre la foto, el botón con el producto al que lleva (mismo buscador que el
 * hero) y dos fotos (escritorio y móvil), más la foto del encabezado de la
 * página de Ofertas, con un solo Guardar. Un 409 significa que otra persona
 * editó el bloque: se avisa y no se pisa nada.
 */
function OfferBannerEditor({ section, onSaved, embedded = false, onDirtyChange }: OfferBannerEditorProps) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(section);
  const [value, setValue] = useState<OfferBannerFormValue>(() => toFormValue(section));
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

  function setImage(slot: Slot, draft: OfferBannerFormValue["images"][Slot]) {
    setValue((current) => ({ ...current, images: { ...current.images, [slot]: draft } }));
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
      const result = await saveOfferBanner(value, saved.version);
      setSaved(result.section);
      setValue(result.value);
      if (!result.imageError) setBaseline(fingerprint(result.value));
      onSaved(result.section);
      if (result.imageError) {
        const message = describe(result.imageError, "No se pudo subir una de las fotos.");
        setFormError(`El texto se guardó, pero una foto no: ${message} Vuelve a darle Guardar para reintentar.`);
        toast({ variant: "error", title: "Falló la subida de una foto", description: message });
      } else {
        toast({ variant: "success", title: "Banner de oferta guardado" });
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        setFormError(
          "Alguien más editó este bloque mientras trabajabas. Recarga la página para ver sus cambios; no se guardó nada tuyo.",
        );
      } else {
        setApiErrors(error instanceof ApiRequestError ? (error.fieldErrors ?? {}) : {});
        setFormError(describe(error, "No se pudo guardar el banner."));
      }
      toast({ variant: "error", title: "No se guardó el banner", description: describe(error, "Intenta de nuevo.") });
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
              <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
                Banner de oferta
              </p>
              <p className="mt-1 max-w-[70ch] text-body-sm text-muted-foreground">
                Una foto a todo lo ancho con una frase que corre sin parar y un botón que lleva al producto en oferta.
              </p>
            </div>
            <Badge color={dirty ? "warning" : "success"}>{dirty ? "Cambios sin guardar" : "Guardado"}</Badge>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Switch
            checked={value.isActive}
            onChange={(isActive) => setValue((c) => ({ ...c, isActive }))}
            label="Mostrar el banner de oferta en la tienda"
          />
          <span className="text-body text-foreground">Mostrar este bloque en la tienda</span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Input
              label="Frase que corre sobre la foto (se muestra en mayúsculas)"
              placeholder="Brilla, hidrata, repite."
              maxLength={HOME_CONTENT_LIMITS.offerTextMax}
              value={value.text}
              onChange={(event) => setValue((c) => ({ ...c, text: event.target.value }))}
              error={errors.text}
            />
            <Input
              label="Texto del botón"
              placeholder="Lo quiero"
              maxLength={HOME_CONTENT_LIMITS.ctaLabelMax}
              value={value.ctaLabel}
              onChange={(event) => setValue((c) => ({ ...c, ctaLabel: event.target.value }))}
              error={errors.ctaLabel}
            />
            <HeroSlideLinkField
              href={value.ctaHref}
              error={errors.ctaHref}
              hint="Al tocar el botón, la clienta llega a este producto."
              onChange={(ctaHref) => setValue((c) => ({ ...c, ctaHref }))}
            />
          </div>
          <div className="grid grid-cols-[3fr_2fr] items-start gap-4">
            <HeroImageSlot
              label="Escritorio"
              dimensions="1920 × 800 px · horizontal"
              aspectClassName="aspect-[12/5]"
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
          <FieldError message="Sin foto de escritorio este banner no se publica en la tienda." />
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <div>
            <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
              Página de Ofertas
            </p>
            <p className="mt-1 max-w-[70ch] text-body-sm text-muted-foreground">
              Foto del encabezado de la página de Ofertas de la tienda. Se muestra aunque este bloque esté apagado; sin
              foto, el encabezado queda en rosa liso.
            </p>
          </div>
          <div className="max-w-xl">
            <HeroImageSlot
              label="Foto del encabezado"
              dimensions="1920 × 640 px · horizontal"
              aspectClassName="aspect-[3/1]"
              draft={value.images.page}
              onChange={(draft) => setImage("page", draft)}
            />
          </div>
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

export { OfferBannerEditor };
