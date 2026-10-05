import Image from "next/image";
import type { ReactNode } from "react";
import type { DemoProduct } from "./fixture";
import { LABEL, SURFACE_VARS } from "./styles";

/**
 * Cómo se enmarca el contenido de Mi cuenta en cada propuesta. Las secciones
 * son las mismas; lo único que cambia es el marco:
 * - `card`: tarjeta blanca con borde (A).
 * - `ruled`: renglones sobre reglas de 1px, sin cajas (B).
 * - `plain`: bloques sueltos separados por una línea tenue (C).
 */
type Tone = "card" | "ruled" | "plain";

interface BlockProps {
  tone: Tone;
  title: string;
  /** Acción del encabezado (Editar, Agregar). */
  action?: ReactNode;
  children: ReactNode;
}

const BLOCK_FRAME: Record<Tone, string> = {
  card: "rounded-md border border-border-strong bg-surface p-5 md:p-6",
  ruled: "border-t border-border-strong py-6",
  plain: "border-b border-border py-6",
};

const BLOCK_TITLE: Record<Tone, string> = {
  card: "text-section-title text-foreground",
  ruled: "type-shop-card-title text-foreground",
  plain: "text-section-title text-foreground",
};

/** Bloque con título y acción: datos personales, contraseña, método de pago. */
function Block({ tone, title, action, children }: BlockProps) {
  return (
    <section style={tone === "card" ? SURFACE_VARS : undefined} className={BLOCK_FRAME[tone]}>
      <div className="mb-5 flex min-h-11 items-center justify-between gap-4">
        <h2 className={BLOCK_TITLE[tone]}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const ITEM_FRAME: Record<Tone, string> = {
  card: "rounded-md border border-border-strong bg-surface p-5",
  ruled: "border-b border-border-strong py-5",
  plain: "border-b border-border py-5",
};

interface ItemListProps {
  tone: Tone;
  /** Dos columnas en escritorio (tarjetas de dirección); un solo renglón por elemento si no. */
  columns?: boolean;
  children: ReactNode;
}

/** Lista de elementos: tarjetas en rejilla en `card`, renglones con reglas en los otros dos. */
function ItemList({ tone, columns = false, children }: ItemListProps) {
  const layout =
    tone === "card"
      ? columns
        ? "grid gap-4 md:grid-cols-2"
        : "flex flex-col gap-3"
      : `flex flex-col border-t ${tone === "ruled" ? "border-border-strong" : "border-border"}`;
  return <ul className={layout}>{children}</ul>;
}

/** Elemento de `ItemList`; en `card` declara su fondo para que Input pinte bien la etiqueta. */
function Item({ tone, children, className = "" }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <li style={tone === "card" ? SURFACE_VARS : undefined} className={`${ITEM_FRAME[tone]} ${className}`}>
      {children}
    </li>
  );
}

interface DataListProps {
  rows: Array<{ label: string; value?: string; mono?: boolean }>;
}

/** Datos en pares etiqueta/valor (voz mono para la etiqueta). Lo que falta se dice, no se deja en blanco. */
function DataList({ rows }: DataListProps) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className={LABEL}>{row.label}</dt>
          <dd className={`mt-1 break-words text-body ${row.value ? (row.mono ? "font-mono text-data text-foreground" : "text-foreground") : "text-muted-foreground-strong"}`}>
            {row.value || "Sin agregar"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface ThumbProps {
  product: Pick<DemoProduct, "name" | "image" | "available">;
  className: string;
  sizes: string;
}

/** Foto del producto en un recuadro; sin foto (respaldo sin API) cae a la inicial. */
function Thumb({ product, className, sizes }: ThumbProps) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-md bg-muted ${product.available ? "" : "opacity-60"} ${className}`}>
      {product.image ? (
        <Image src={product.image.url} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-mono text-subtitle text-muted-foreground-strong">
          {product.name.charAt(0)}
        </span>
      )}
    </div>
  );
}

/** Aviso corto tras una acción (guardado, reanudado). `status` para que se anuncie solo. */
function Notice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "warning" | "danger" }) {
  const palette = {
    success: "bg-secondary text-secondary-foreground",
    warning: "bg-accent text-accent-foreground-strong",
    danger: "bg-destructive/40 text-destructive-action",
  }[tone];
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={`mb-5 rounded-md px-4 py-3 text-body-sm ${palette}`}>
      {children}
    </p>
  );
}

export { Block, ItemList, Item, DataList, Thumb, Notice };
export type { Tone };
