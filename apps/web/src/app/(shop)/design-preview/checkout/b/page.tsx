import { CartDrawer } from "../_kit/cart-drawer";
import { DrawerBackdrop } from "../_kit/drawer-backdrop";
import { getPreviewData } from "../_kit/fixture";
import { OrderDone } from "../_kit/order-done";
import { PreviewBar } from "../_kit/preview-bar";
import { readPreviewState, type SearchParams } from "../_kit/preview-state";
import { cheapestRate } from "../_kit/shipping-labels";
import { computeTotals } from "../_kit/totals";
import { CartPageB } from "./cart-page";
import { CheckoutB } from "./checkout";

const BASE = "/design-preview/checkout/b";

/** Propuesta B: banda y panel rosa, checkout en acordeón. */
export default async function ProposalB({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const current = readPreviewState(await searchParams);
  const data = await getPreviewData();
  const key = `${current.view}-${current.state ?? "base"}`;
  const rate = cheapestRate(data.rates);

  return (
    <>
      {current.view === "panel" ? (
        <>
          <DrawerBackdrop line={data.lines[0]} />
          <CartDrawer key={key} variant="b" data={data} state={current.state} base={BASE} />
        </>
      ) : null}
      {current.view === "carrito" ? <CartPageB key={key} data={data} state={current.state} base={BASE} /> : null}
      {current.view === "cuenta" || current.view === "envio" || current.view === "pago" ? (
        <CheckoutB key={key} data={data} view={current.view} state={current.state} base={BASE} />
      ) : null}
      {current.view === "listo" ? (
        <main className="min-h-[100dvh] bg-blush">
          <div className="mx-auto max-w-3xl px-4 pt-28 pb-32 md:px-8">
            <OrderDone data={data} rate={rate} totals={computeTotals(data.lines, rate.amountCents)} oxxo={current.state === "oxxo"} />
          </div>
        </main>
      ) : null}
      <PreviewBar base={BASE} label="B" current={current} />
    </>
  );
}
