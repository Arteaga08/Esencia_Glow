"use client";

import { useId, useState } from "react";
import { Storefront, Truck, WhatsappLogo } from "@phosphor-icons/react";
import { formatMoneyMXN } from "@/lib/format-money";
import { WHATSAPP_HREF } from "@/lib/storefront/contact";
import { LOCAL_DELIVERY_FEE_CENTS } from "@/lib/storefront/delivery";
import { FOCUS } from "./product-styles";

type Kind = "local" | "national";

const TABS = [
  { kind: "local" as const, title: "Entrega local", icon: Storefront },
  { kind: "national" as const, title: "Envío nacional", icon: Truck },
];

/**
 * Formas de entrega bajo el botón de agregar: dos botones lado a lado que
 * arrancan cerrados. Tocar uno abre su detalle; tocarlo otra vez, o tocar el
 * otro, lo cierra o lo cambia. La altura se anima con `grid-template-rows`.
 */
function DeliveryInfo() {
  const panelId = useId();
  const [open, setOpen] = useState<Kind | null>(null);

  return (
    <section aria-label="Formas de entrega">
      <div className="grid grid-cols-2 gap-2">
        {TABS.map(({ kind, title, icon: TabIcon }) => {
          const active = kind === open;
          return (
            <button
              key={kind}
              type="button"
              aria-expanded={active}
              aria-controls={panelId}
              onClick={() => setOpen(active ? null : kind)}
              className={`flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-body-sm text-foreground transition-colors duration-[var(--duration-base)] ease-out-quart ${FOCUS} ${
                active ? "border-primary-action bg-blush" : "border-border-strong bg-transparent hover:bg-muted"
              }`}
            >
              <TabIcon size={18} aria-hidden="true" weight={active ? "fill" : "regular"} />
              {title}
            </button>
          );
        })}
      </div>

      <div id={panelId} role="region" aria-label="Detalle de la entrega" className={`grid transition-[grid-template-rows] duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="px-1 pt-3">
            {open === "national" ? (
              <>
                <p className="text-body-sm text-foreground">Enviamos a todo México.</p>
                <p className="mt-1 text-body-sm text-muted-foreground-strong">El costo y la paquetería se acuerdan contigo por WhatsApp al confirmar tu pedido.</p>
                <a href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer" className={`mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground ${FOCUS}`}>
                  <WhatsappLogo size={18} weight="fill" aria-hidden="true" />
                  Preguntar por WhatsApp
                </a>
              </>
            ) : (
              <>
                <dl className="flex flex-col gap-1.5 text-body-sm">
                  <div className="flex justify-between gap-4">
                    <dt>Recoger en tienda</dt>
                    <dd className="font-mono tabular-nums">Gratis</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>A domicilio</dt>
                    <dd className="font-mono tabular-nums">{formatMoneyMXN(LOCAL_DELIVERY_FEE_CENTS)}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-body-sm text-muted-foreground-strong">Al terminar tu pedido te escribimos por WhatsApp para fijar día y hora.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export { DeliveryInfo };
