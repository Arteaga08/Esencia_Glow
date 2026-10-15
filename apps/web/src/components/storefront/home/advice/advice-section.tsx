import type { CSSProperties } from "react";
import Image from "next/image";
import type { PublicHomeAdvice } from "@esencia-glow/shared";
import { ADVICE_WHATSAPP_HREF } from "../../../../lib/storefront/contact";

const CTA_BUTTON =
  "mt-8 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md bg-foreground px-7 py-3 " +
  "type-shop-cta text-background hover:bg-primary-action " +
  "transition-colors duration-[var(--duration-base)] ease-out-quart " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Ancho promedio de una letra de Zen Maru Gothic en negrita, en `em`: sirve para que la palabra quepa. */
const LETTER_WIDTH_EM = 0.56;

/**
 * Tamaño de la palabra del arco según su largo: lo más grande que quepa en su
 * columna (casi toda la pantalla en móvil, ~40 % del ancho desde `md`), con
 * tope para que una palabra corta no se coma la foto.
 */
function archWordSize(word: string): CSSProperties {
  const ems = word.length * LETTER_WIDTH_EM;
  return {
    "--word-sm": `${Math.min(19, 88 / ems).toFixed(2)}vw`,
    "--word-md": `${Math.min(8.6, 40 / ems).toFixed(2)}vw`,
  } as CSSProperties;
}

/**
 * Bloque de asesoría: a la izquierda, la foto en una ventana de arco sobre
 * rosa intenso con la palabra grande encima (un velo del mismo rosa al pie
 * la asienta sobre cualquier foto); a la derecha, etiqueta, título, texto y el
 * botón que abre el WhatsApp de asesoría. En móvil se apilan, foto arriba.
 */
function AdviceSection({ advice }: { advice: PublicHomeAdvice }) {
  return (
    <section aria-labelledby="advice-title" className="grid md:grid-cols-[5fr_6fr]">
      <div className="relative flex items-center justify-center overflow-hidden bg-primary-action px-6 py-12 md:min-h-[42rem]">
        <div className="relative aspect-[3/4] w-[62%] max-w-sm overflow-hidden rounded-t-full xl:max-w-md">
          <Image
            src={advice.image.url}
            alt={advice.image.alt ?? ""}
            fill
            sizes="(min-width: 1280px) 448px, (min-width: 768px) 26vw, 62vw"
            className="object-cover"
          />
          {advice.archWord ? (
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-primary-action to-transparent"
            />
          ) : null}
        </div>
        {advice.archWord ? (
          <span
            aria-hidden="true"
            style={archWordSize(advice.archWord)}
            className="pointer-events-none absolute inset-x-0 bottom-[16%] text-center font-display text-(length:--word-sm) leading-none font-bold tracking-[-0.03em] whitespace-nowrap text-primary-foreground select-none md:text-(length:--word-md)"
          >
            {advice.archWord}
          </span>
        ) : null}
      </div>
      <div className="flex items-center bg-accent px-4 py-14 md:px-12 lg:px-24">
        <div className="max-w-xl">
          {advice.eyebrow ? <p className="mb-4 type-shop-cta text-accent-foreground-strong">{advice.eyebrow}</p> : null}
          <h2
            id="advice-title"
            className="font-display text-[clamp(2.25rem,1.4rem+3vw,3.75rem)] leading-[1.05] font-bold tracking-[-0.02em] text-foreground"
          >
            {advice.title}
          </h2>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-foreground">{advice.body}</p>
          <a href={ADVICE_WHATSAPP_HREF} target="_blank" rel="noopener noreferrer" className={CTA_BUTTON}>
            {advice.ctaLabel}
          </a>
        </div>
      </div>
    </section>
  );
}

export { AdviceSection };
