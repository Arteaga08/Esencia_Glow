interface StockFiguresProps {
  onHand: number | null;
  reserved: number | null;
  available: number | null;
}

/** `null` es "sin registro", no cero: se pinta un guion, nunca `0`. */
function formatFigure(value: number | null): string {
  return value === null ? "-" : String(value);
}

const FIGURES: { key: "onHand" | "reserved" | "available"; label: string }[] = [
  { key: "onHand", label: "En mano" },
  { key: "reserved", label: "Apartado" },
  { key: "available", label: "Disponible" },
];

/**
 * Las tres cifras de inventario, siempre en el mismo orden y alineadas a la
 * derecha en columnas de ancho fijo para que se lean hacia abajo entre
 * filas. Las etiquetas se dicen una vez en `StockFiguresHeader`; aquí van
 * solo para lectores de pantalla. Disponible va en `foreground`: es la cifra que decide si hay que
 * surtir; las otras dos la explican.
 */
function StockFigures({ onHand, reserved, available }: StockFiguresProps) {
  const values = { onHand, reserved, available };

  return (
    <dl className="flex shrink-0 items-end gap-4">
      {FIGURES.map((figure) => (
        <div key={figure.key} className="flex w-16 flex-col items-end gap-0.5">
          <dt className="sr-only">
            {figure.label}
          </dt>
          <dd
            className={
              "font-mono tabular-nums " +
              (figure.key === "available" ? "text-body text-foreground" : "text-body-sm text-muted-foreground-strong")
            }
          >
            {formatFigure(values[figure.key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Encabezado de columnas de la lista: las etiquetas se dicen una vez
 * arriba, no en cada fila. */
function StockFiguresHeader() {
  return (
    <div aria-hidden="true" className="flex shrink-0 gap-4">
      {FIGURES.map((figure) => (
        <span
          key={figure.key}
          className="w-16 text-right font-mono text-label uppercase tracking-[0.06em] text-muted-foreground"
        >
          {figure.label}
        </span>
      ))}
    </div>
  );
}

export { StockFigures, StockFiguresHeader };
