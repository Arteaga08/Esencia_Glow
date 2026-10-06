import type { CSSProperties } from "react";
import { FOCUS } from "@/components/storefront/product/product-styles";

/**
 * Botones de acceso y Mi Cuenta como clases: muchos son enlaces, así que no
 * pueden ser `<Button>`. Mismo acabado que el botón de agregar de la página de
 * producto (rosa suave, borde de acción, texto tinta; el hover es un cambio de
 * color, nunca una elevación).
 */
const BASE = `inline-flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-md border px-6 type-shop-cta text-foreground transition-[background-color,border-color,transform] duration-[var(--duration-base)] ease-out-quart active:scale-[0.98] motion-reduce:active:scale-100 ${FOCUS}`;

const CTA_PRIMARY = `${BASE} h-12 border-primary-action bg-primary hover:bg-blush`;
const CTA_SECONDARY = `${BASE} h-12 border-border-strong bg-surface hover:bg-muted`;
const CTA_DISABLED =
  "inline-flex h-12 min-w-0 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-border bg-muted px-6 type-shop-cta text-muted-foreground-strong";

const TEXT_LINK = `inline-flex min-h-11 cursor-pointer items-center text-body-sm text-foreground underline decoration-border-strong underline-offset-4 transition-colors duration-[var(--duration-fast)] hover:decoration-foreground ${FOCUS}`;

/** Acción de bajo peso dentro de un renglón (Editar, Quitar): texto, sin subrayado fijo. */
const ROW_ACTION = `inline-flex min-h-11 cursor-pointer items-center px-1 text-body-sm text-foreground underline decoration-transparent underline-offset-4 transition-colors duration-[var(--duration-fast)] hover:decoration-foreground ${FOCUS}`;

/** Etiqueta de campo/grupo en la voz mono del sistema. */
const LABEL = "font-mono text-label uppercase text-muted-foreground-strong";

/** Las superficies blancas declaran su fondo para tapar el borde bajo la etiqueta de Input. */
const SURFACE_VARS = { "--surface-bg": "var(--color-surface)" } as CSSProperties;

export { CTA_PRIMARY, CTA_SECONDARY, CTA_DISABLED, TEXT_LINK, ROW_ACTION, LABEL, SURFACE_VARS, FOCUS };
