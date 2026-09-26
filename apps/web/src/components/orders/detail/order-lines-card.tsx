import type { PublicOrderLine, PublicOrderTotals } from "@esencia-glow/shared";
import { Card } from "@/components/ui/card";
import { Table, type TableColumn } from "@/components/ui/table";
import { formatMoneyMXN } from "@/lib/format-money";
import { OrderTotals } from "./order-totals";

function lineAttributesText(line: PublicOrderLine): string | null {
  const parts = [
    line.variantName,
    line.attributes?.size,
    line.attributes?.shade,
    line.attributes?.volume,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

const COLUMNS: TableColumn<PublicOrderLine>[] = [
  {
    header: "Producto",
    render: (line) => (
      <div>
        <p className="text-body text-foreground">{line.name}</p>
        {lineAttributesText(line) ? (
          <p className="text-body-sm text-muted-foreground">{lineAttributesText(line)}</p>
        ) : null}
        <p className="font-mono text-body-sm tabular-nums text-muted-foreground">{line.sku}</p>
        {line.components && line.components.length > 0 ? (
          <ul className="mt-1.5 flex flex-col gap-0.5 border-l border-border pl-3">
            {line.components.map((component) => (
              <li key={`${component.productId}-${component.variantId}`} className="text-body-sm text-muted-foreground">
                {component.quantity}× {component.name}
                {component.variantName ? ` (${component.variantName})` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    ),
  },
  { header: "Cantidad", align: "right", render: (line) => line.quantity },
  { header: "Precio unitario", align: "right", render: (line) => formatMoneyMXN(line.unitPriceCents) },
  { header: "Total", align: "right", render: (line) => formatMoneyMXN(line.lineTotalCents) },
];

/** Sin miniatura: el DTO admin omite `image` a propósito (`order-dto.ts`).
 * Sin acciones: editar las líneas de un pedido ya cobrado queda fuera de
 * este milestone (toca dinero capturado + inventario reservado). */
function OrderLinesCard({ lines, totals }: { lines: PublicOrderLine[]; totals: PublicOrderTotals }) {
  return (
    <Card>
      <p className="mb-4 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
        Artículos ({lines.length})
      </p>
      <Table columns={COLUMNS} rows={lines} rowKey={(line) => `${line.itemType}-${line.itemId}`} />
      <OrderTotals totals={totals} />
    </Card>
  );
}

export { OrderLinesCard };
