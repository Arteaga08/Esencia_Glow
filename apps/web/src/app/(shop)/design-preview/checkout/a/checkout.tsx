"use client";

import { useState } from "react";
import { AccountStep } from "../_kit/account-step";
import { SummaryBody, SummaryDisclosure } from "../_kit/checkout-summary";
import { PaymentStep } from "../_kit/payment-step";
import { previewHref } from "../_kit/preview-state";
import type { PreviewData } from "../_kit/preview-types";
import { cheapestRate } from "../_kit/shipping-labels";
import { ShippingStep } from "../_kit/shipping-step";
import { AccountDone, ShippingDone } from "../_kit/step-summaries";
import { computeTotals } from "../_kit/totals";
import { StepSection, type StepStatus } from "./step-section";

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
 * Propuesta A, checkout en una sola página: cuenta, envío y pago apilados y
 * visibles a la vez, con el resumen fijo a la derecha (en móvil, plegado
 * arriba con el total a la vista). Avanzar no oculta nada: lo hecho queda como
 * resumen y lo que falta, apagado.
 */
function CheckoutA({ data, view, state, base }: CheckoutProps) {
  const [rateId, setRateId] = useState(() => cheapestRate(data.rates).rateId);
  const rate = data.rates.find((candidate) => candidate.rateId === rateId) ?? cheapestRate(data.rates);
  const totals = computeTotals(data.lines, view === "cuenta" ? null : rate.amountCents);
  const summary = <SummaryBody lines={data.lines} totals={totals} />;

  return (
    <main className="pt-16 pb-32 xl:pt-20">
      <SummaryDisclosure totals={totals} className="border-t-0 lg:hidden">
        {summary}
      </SummaryDisclosure>

      <div className="mx-auto grid max-w-shell gap-12 px-4 py-10 md:px-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16 xl:px-12">
        <div>
          <h1 className="text-page-title text-foreground md:text-display">Finalizar compra</h1>
          <div className="mt-8">
            <StepSection number={1} title="Cuenta" status={statusOf("cuenta", view)} waiting="">
              {view === "cuenta" ? (
                <AccountStep state={state} email={data.email} firstName={data.firstName} nextHref={previewHref(base, "envio")} verifyHref={previewHref(base, "cuenta", "verificar")} />
              ) : (
                <AccountDone firstName={data.firstName} email={data.email} changeHref={previewHref(base, "cuenta")} />
              )}
            </StepSection>
            <StepSection number={2} title="Envío" status={statusOf("envio", view)} waiting="Disponible cuando inicies sesión.">
              {view === "envio" ? (
                <ShippingStep state={state} address={data.address} rates={data.rates} selectedRateId={rateId} onSelectRate={setRateId} nextHref={previewHref(base, "pago")} retryHref={previewHref(base, "envio")} />
              ) : (
                <ShippingDone address={data.address} rate={rate} changeHref={previewHref(base, "envio")} />
              )}
            </StepSection>
            <StepSection number={3} title="Pago" status={statusOf("pago", view)} waiting="Disponible cuando elijas el envío.">
              <PaymentStep state={state} totalCents={totals.totalCents} doneHref={previewHref(base, "listo")} oxxoDoneHref={previewHref(base, "listo", "oxxo")} />
            </StepSection>
          </div>
        </div>

        <aside className="hidden rounded-md border border-border-strong bg-surface p-6 lg:sticky lg:top-28 lg:block lg:self-start">
          <h2 className="mb-5 type-shop-card-title text-foreground">Tu pedido</h2>
          {summary}
        </aside>
      </div>
    </main>
  );
}

export { CheckoutA };
export type { CheckoutView };
