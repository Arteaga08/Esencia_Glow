"use client";

import Link from "next/link";
import { useState } from "react";
import { AccountStep } from "../_kit/account-step";
import { SummaryBody, SummaryDisclosure } from "../_kit/checkout-summary";
import { TEXT_LINK } from "../_kit/cta-styles";
import { PaymentStep } from "../_kit/payment-step";
import { previewHref } from "../_kit/preview-state";
import type { PreviewData } from "../_kit/preview-types";
import { cheapestRate } from "../_kit/shipping-labels";
import { ShippingStep } from "../_kit/shipping-step";
import { AccountDone, ShippingDone } from "../_kit/step-summaries";
import { computeTotals } from "../_kit/totals";
import { AccordionStep, type StepStatus } from "./accordion-step";

type CheckoutView = "cuenta" | "envio" | "pago";

interface CheckoutProps {
  data: PreviewData;
  view: CheckoutView;
  state: string | null;
  base: string;
}

const ORDER: CheckoutView[] = ["cuenta", "envio", "pago"];

function statusOf(step: CheckoutView, current: CheckoutView): StepStatus {
  const diff = ORDER.indexOf(step) - ORDER.indexOf(current);
  return diff < 0 ? "done" : diff === 0 ? "active" : "upcoming";
}

/**
 * Propuesta B, checkout en acordeón: un paso abierto a la vez. Banda rosa con
 * el título arriba, pasos a la izquierda y el resumen en un panel rosa a la
 * derecha (plegado arriba en móvil).
 */
function CheckoutB({ data, view, state, base }: CheckoutProps) {
  const [rateId, setRateId] = useState(() => cheapestRate(data.rates).rateId);
  const rate = data.rates.find((candidate) => candidate.rateId === rateId) ?? cheapestRate(data.rates);
  const totals = computeTotals(data.lines, view === "cuenta" ? null : rate.amountCents);
  const summary = <SummaryBody lines={data.lines} totals={totals} />;

  return (
    <main className="pt-16 pb-32 xl:pt-20">
      <header className="bg-blush">
        <div className="mx-auto flex max-w-shell flex-wrap items-end justify-between gap-x-6 gap-y-1 px-4 py-8 md:px-8 md:py-12 xl:px-12">
          <h1 className="text-page-title text-foreground md:text-display">Finalizar compra</h1>
          <Link href={previewHref(base, "carrito")} className={TEXT_LINK}>
            Volver al carrito
          </Link>
        </div>
      </header>

      <SummaryDisclosure totals={totals} className="border-t-0 bg-blush lg:hidden">
        {summary}
      </SummaryDisclosure>

      <div className="mx-auto grid max-w-shell gap-10 px-4 py-10 md:px-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16 xl:px-12">
        <div className="flex flex-col gap-3">
          <AccordionStep
            number={1}
            title="Cuenta"
            status={statusOf("cuenta", view)}
            summary={<AccountDone firstName={data.firstName} email={data.email} changeHref={previewHref(base, "cuenta")} />}
          >
            <AccountStep state={state} email={data.email} firstName={data.firstName} nextHref={previewHref(base, "envio")} verifyHref={previewHref(base, "cuenta", "verificar")} />
          </AccordionStep>
          <AccordionStep
            number={2}
            title="Envío"
            status={statusOf("envio", view)}
            summary={<ShippingDone address={data.address} rate={rate} changeHref={previewHref(base, "envio")} />}
          >
            <ShippingStep state={state} address={data.address} rates={data.rates} selectedRateId={rateId} onSelectRate={setRateId} nextHref={previewHref(base, "pago")} retryHref={previewHref(base, "envio")} />
          </AccordionStep>
          <AccordionStep number={3} title="Pago" status={statusOf("pago", view)}>
            <PaymentStep state={state} totalCents={totals.totalCents} doneHref={previewHref(base, "listo")} oxxoDoneHref={previewHref(base, "listo", "oxxo")} />
          </AccordionStep>
        </div>

        <aside className="hidden rounded-md bg-blush p-6 lg:sticky lg:top-28 lg:block lg:self-start">
          <h2 className="mb-5 type-shop-card-title text-foreground">Tu pedido</h2>
          {summary}
        </aside>
      </div>
    </main>
  );
}

export { CheckoutB };
