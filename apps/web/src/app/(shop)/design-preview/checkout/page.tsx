import Link from "next/link";
import { CTA_SECONDARY } from "./_kit/cta-styles";

const PROPOSALS = [
  {
    key: "a",
    title: "A. Una sola página",
    description: "Carrito con resumen fijo. Checkout con cuenta, envío y pago apilados y siempre visibles; lo que falta se ve apagado.",
  },
  {
    key: "b",
    title: "B. Acordeón",
    description: "Banda y panel rosa. Un paso abierto a la vez; los terminados se cierran a un renglón con Cambiar.",
  },
  {
    key: "c",
    title: "C. Un paso por pantalla",
    description: "Carrito de fotos grandes. Checkout con header mínimo, barra de tres pasos y resumen en panel lateral.",
  },
];

const ENTRIES = [
  { view: "panel", label: "Panel lateral" },
  { view: "carrito", label: "Carrito" },
  { view: "cuenta", label: "Checkout" },
  { view: "listo", label: "Confirmación" },
];

/** Índice de las tres propuestas de carrito y checkout (Milestone 3.4). Se borra al elegir una. */
export default function CheckoutPreviewIndex() {
  return (
    <main className="mx-auto max-w-shell px-4 pt-28 pb-20 md:px-8 xl:px-12">
      <h1 className="text-page-title text-foreground md:text-display">Carrito y checkout</h1>
      <p className="mt-2 max-w-[60ch] text-body text-foreground/80">
        Tres propuestas con datos de ejemplo. Los botones navegan de verdad entre vistas; abajo de cada una hay una barra para saltar a cualquier vista o estado.
      </p>
      <ul className="mt-10 grid gap-10 lg:grid-cols-3">
        {PROPOSALS.map((proposal) => (
          <li key={proposal.key} className="flex flex-col gap-4 border-t border-border-strong pt-6">
            <h2 className="text-section-title text-foreground">{proposal.title}</h2>
            <p className="text-body text-foreground/80">{proposal.description}</p>
            <div className="flex flex-wrap gap-2">
              {ENTRIES.map((entry) => (
                <Link key={entry.view} href={`/design-preview/checkout/${proposal.key}?vista=${entry.view}`} className={`${CTA_SECONDARY} !h-11 !px-4`}>
                  {entry.label}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
