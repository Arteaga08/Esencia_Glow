import Image from "next/image";
import type { ReactNode } from "react";
import { LABEL, SURFACE_VARS } from "./styles";

/**
 * Marco de las secciones de Mi cuenta (propuesta A): tarjeta blanca con borde.
 * Cada bloque declara `--surface-bg` para que la etiqueta de `Input` tape bien
 * el borde.
 */

interface BlockProps {
  title: string;
  /** Acción del encabezado (Editar, Agregar). */
  action?: ReactNode;
  children: ReactNode;
}

/** Bloque con título y acción: datos personales, contraseña, plan. */
function Block({ title, action, children }: BlockProps) {
  return (
    <section style={SURFACE_VARS} className="rounded-md border border-border-strong bg-surface p-5 md:p-6">
      <div className="mb-5 flex min-h-11 items-center justify-between gap-4">
        <h2 className="text-section-title text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

interface ItemListProps {
  /** Dos columnas en escritorio (tarjetas de dirección). */
  columns?: boolean;
  children: ReactNode;
}

function ItemList({ columns = false, children }: ItemListProps) {
  return <ul className={columns ? "grid gap-4 md:grid-cols-2" : "flex flex-col gap-3"}>{children}</ul>;
}

function Item({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <li style={SURFACE_VARS} className={`rounded-md border border-border-strong bg-surface p-5 ${className}`}>
      {children}
    </li>
  );
}

interface DataListProps {
  rows: Array<{ label: string; value?: string | null; mono?: boolean }>;
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
  name: string;
  image?: { url: string } | null;
  available?: boolean;
  className: string;
  sizes: string;
}

/** Foto del producto en un recuadro; sin foto cae a la inicial. */
function Thumb({ name, image, available = true, className, sizes }: ThumbProps) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-md bg-muted ${available ? "" : "opacity-60"} ${className}`}>
      {image ? (
        <Image src={image.url} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-mono text-subtitle text-muted-foreground-strong">
          {name.charAt(0)}
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
