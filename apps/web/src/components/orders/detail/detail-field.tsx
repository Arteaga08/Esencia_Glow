import type { ReactNode } from "react";

interface DetailFieldProps {
  label: string;
  children: ReactNode;
  /** Cifras y códigos van en `font-mono tabular-nums` (convención del panel). */
  mono?: boolean;
}

/** Par etiqueta/valor reutilizado por Pago, Envío y Cliente — evita seis
 * variantes del mismo grid de dos columnas. */
function DetailField({ label, children, mono = false }: DetailFieldProps) {
  return (
    <div>
      <dt className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">{label}</dt>
      <dd className={"mt-0.5 text-body text-foreground " + (mono ? "font-mono tabular-nums" : "")}>{children}</dd>
    </div>
  );
}

export { DetailField };
