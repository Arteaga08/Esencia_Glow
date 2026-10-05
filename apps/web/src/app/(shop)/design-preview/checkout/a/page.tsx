import { CartDrawer } from "../_kit/cart-drawer";
import { DrawerBackdrop } from "../_kit/drawer-backdrop";
import { getPreviewData } from "../_kit/fixture";
import { OrderDone } from "../_kit/order-done";
import { PreviewBar } from "../_kit/preview-bar";
import { readPreviewState, type SearchParams } from "../_kit/preview-state";
import { cheapestRate } from "../_kit/shipping-labels";
import { computeTotals } from "../_kit/totals";
import { CartPageA } from "./cart-page";
import { CheckoutA } from "./checkout";

const BASE = "/design-preview/checkout/a";

/** Propuesta A: carrito con resumen fijo y checkout de una sola página. */
export default async function ProposalA({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const current = readPreviewState(await searchParams);
  const data = await getPreviewData();
  const key = `${current.view}-${current.state ?? "base"}`;
  const rate = cheapestRate(data.rates);

  return (
    <>
      {current.view === "panel" ? (
        <>
          <DrawerBackdrop line={data.lines[0]} />
          <CartDrawer key={key} variant="a" data={data} state={current.state} base={BASE} />
        </>
      ) : null}
      {current.view === "carrito" ? <CartPageA key={key} data={data} state={current.state} base={BASE} /> : null}
      {current.view === "cuenta" || current.view === "envio" || current.view === "pago" ? (
        <CheckoutA key={key} data={data} view={current.view} state={current.state} base={BASE} />
      ) : null}
      {current.view === "listo" ? (
        <main className="mx-auto max-w-5xl px-4 pt-28 pb-32 md:px-8">
          <OrderDone data={data} rate={rate} totals={computeTotals(data.lines, rate.amountCents)} oxxo={current.state === "oxxo"} split />
        </main>
      ) : null}
      <PreviewBar base={BASE} label="A" current={current} />
    </>
  );
}
