"use client";

import Link from "next/link";
import { useState } from "react";
import { AccountStep } from "../_kit/account-step";
import { SummaryBody, SummaryDisclosure } from "../_kit/checkout-summary";
import { TEXT_LINK } from "@/components/storefront/cart/cta-styles";
import { PaymentStep } from "../_kit/payment-step";
import { previewHref } from "../_kit/preview-state";
import type { PreviewData } from "../_kit/preview-types";
import { cheapestRate } from "../_kit/shipping-labels";
import { ShippingStep } from "../_kit/shipping-step";
import { computeTotals } from "../_kit/totals";
import { CheckoutHeader } from "./checkout-header";
import { Progress } from "./progress";

type CheckoutView = "cuenta" | "envio" | "pago";

interface CheckoutProps {
  data: PreviewData;
  view: CheckoutView;
  state: string | null;
  base: string;
}

const COPY: Record<CheckoutView, { title: string; lead: string; back: CheckoutView | "carrito" }> = {
  cuenta: { title: "Cuenta", lead: "Entra o crea tu cuenta para guardar tu pedido.", back: "carrito" },
  envio: { title: "Envío", lead: "¿A dónde enviamos tu pedido?", back: "cuenta" },
  pago: { title: "Pago", lead: "Elige cómo quieres pagar.", back: "envio" },
};

/**
 * Propuesta C, checkout paso por pantalla: header mínimo, barra de tres pasos
 * y un solo paso a la vez. En escritorio el resumen vive en un panel rosa fijo
 * a la izquierda; en móvil se pliega arriba con el total a la vista.
 */
function CheckoutC({ data, view, state, base }: CheckoutProps) {
  const [rateId, setRateId] = useState(() => cheapestRate(data.rates).rateId);
  const rate = data.rates.find((candidate) => candidate.rateId === rateId) ?? cheapestRate(data.rates);
  const totals = computeTotals(data.lines, view === "cuenta" ? null : rate.amountCents);
  const summary = <SummaryBody lines={data.lines} totals={totals} />;
  const copy = COPY[view];

  return (
    <>
      <CheckoutHeader cartHref={previewHref(base, "carrito")} />
      <main className="min-h-[100dvh] pt-16 pb-32 xl:pt-20">
        <SummaryDisclosure totals={totals} className="border-t-0 bg-blush lg:hidden">
          {summary}
        </SummaryDisclosure>

        <div className="lg:grid lg:grid-cols-[5fr_7fr]">
          <aside className="hidden bg-blush p-10 lg:sticky lg:top-20 lg:block lg:h-[calc(100dvh-5rem)] lg:overflow-y-auto xl:p-14">
            <h2 className="mb-6 type-shop-card-title text-foreground">Tu pedido</h2>
            {summary}
          </aside>

          <div className="px-4 py-10 md:px-8 lg:px-14 lg:py-14 xl:px-20">
            <div className="max-w-xl">
              <Progress current={view} base={base} />
              <h1 className="mt-10 type-shop-section text-foreground">{copy.title}</h1>
              <p className="mt-2 mb-8 text-body text-foreground/80">{copy.lead}</p>

              {view === "cuenta" ? (
                <AccountStep state={state} email={data.email} firstName={data.firstName} nextHref={previewHref(base, "envio")} verifyHref={previewHref(base, "cuenta", "verificar")} />
              ) : null}
              {view === "envio" ? (
                <ShippingStep state={state} address={data.address} rates={data.rates} selectedRateId={rateId} onSelectRate={setRateId} nextHref={previewHref(base, "pago")} retryHref={previewHref(base, "envio")} />
              ) : null}
              {view === "pago" ? (
                <PaymentStep state={state} totalCents={totals.totalCents} doneHref={previewHref(base, "listo")} oxxoDoneHref={previewHref(base, "listo", "oxxo")} />
              ) : null}

              <Link href={previewHref(base, copy.back)} className={`${TEXT_LINK} mt-8`}>
                {copy.back === "carrito" ? "Volver al carrito" : "Atrás"}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export { CheckoutC };
