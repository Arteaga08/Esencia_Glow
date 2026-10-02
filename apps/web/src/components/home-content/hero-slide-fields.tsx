"use client";

import { Trash } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FieldError } from "@/components/ui/field-error";
import { HeroImageSlot } from "./hero-image-slot";
import { HeroSlideLinkField } from "./hero-slide-link-field";
import {
  hasDesktopImage,
  type HeroImageSlot as Slot,
  type HeroSlideDraft,
} from "./hero-form-value";

interface HeroSlideFieldsProps {
  slide: HeroSlideDraft;
  position: number;
  errors: Record<string, string>;
  onChange: (patch: Partial<HeroSlideDraft>) => void;
  onRemove: () => void;
}

/** Campos de un slide: textos, producto al que lleva, estado y las dos fotos. */
function HeroSlideFields({ slide, position, errors, onChange, onRemove }: HeroSlideFieldsProps) {
  function setImage(slot: Slot, draft: HeroSlideDraft["images"][Slot]) {
    onChange({ images: { ...slide.images, [slot]: draft } });
  }

  return (
    <fieldset className="flex flex-col gap-5 rounded-lg border border-border p-5">
      <legend className="px-2 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
        Slide {position + 1}
      </legend>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Switch
            checked={slide.isActive}
            onChange={(isActive) => onChange({ isActive })}
            label={`Slide ${position + 1} activo`}
          />
          <span className="text-body-sm text-foreground">
            {slide.isActive ? "Visible en la tienda" : "Oculto"}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex cursor-pointer items-center gap-1.5 text-body-sm text-destructive-action hover:underline"
        >
          <Trash size={16} aria-hidden="true" />
          Eliminar slide
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Input
            label="Título"
            placeholder="Protector solar Sunprise"
            value={slide.title}
            onChange={(event) => onChange({ title: event.target.value })}
            error={errors.title}
          />
          <Input
            label="Subtítulo (opcional)"
            placeholder="Tu dúo para la piel en pleno verano"
            value={slide.subtitle}
            onChange={(event) => onChange({ subtitle: event.target.value })}
            error={errors.subtitle}
          />
          <HeroSlideLinkField
            href={slide.ctaHref}
            error={errors.ctaHref}
            onChange={(ctaHref) => onChange({ ctaHref })}
          />
        </div>
        <div className="grid grid-cols-[3fr_2fr] items-start gap-4">
          <HeroImageSlot
            label="Escritorio"
            dimensions="1920 × 1080 px · horizontal"
            aspectClassName="aspect-video"
            draft={slide.images.desktop}
            onChange={(draft) => setImage("desktop", draft)}
          />
          <HeroImageSlot
            label="Móvil"
            dimensions="1080 × 1920 px · vertical"
            aspectClassName="aspect-[9/16]"
            draft={slide.images.mobile}
            onChange={(draft) => setImage("mobile", draft)}
          />
        </div>
      </div>

      {!hasDesktopImage(slide) ? (
        <FieldError message="Sin imagen de escritorio este slide no se publica en la tienda." />
      ) : null}
    </fieldset>
  );
}

export { HeroSlideFields };
