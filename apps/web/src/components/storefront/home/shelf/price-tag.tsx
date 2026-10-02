import { formatMoneyMXN } from "@/lib/format-money";

interface PriceTagProps {
  priceCents: number;
  listPriceCents?: number;
  className?: string;
}

/** Precio de una tarjeta: el vigente en tinta, el de lista tachado y apagado. */
function PriceTag({ priceCents, listPriceCents, className = "" }: PriceTagProps) {
  return (
    <p className={`flex items-baseline gap-2 text-body ${className}`}>
      <span className="font-medium text-foreground">{formatMoneyMXN(priceCents)}</span>
      {listPriceCents ? (
        <s className="text-body-sm text-muted-foreground-strong">{formatMoneyMXN(listPriceCents)}</s>
      ) : null}
    </p>
  );
}

export { PriceTag };
