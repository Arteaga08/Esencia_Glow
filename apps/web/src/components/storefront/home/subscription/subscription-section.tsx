"use client";

import { useState } from "react";
import { formatPesos, type Availability, type PeriodView } from "../../../../lib/storefront/subscription-periods";
import { BoxPhoto, type BoxPhotoData } from "./box-photo";
import { HighlightsList } from "./highlights-list";
import { PeriodPicker } from "./period-picker";
import { SubscribeButton } from "./subscribe-button";

interface SubscriptionSectionProps {
  name: string;
  highlights: string[];
  periods: PeriodView[];
  availability: Availability;
  photo: BoxPhotoData | null;
}

/**
 * La foto de la caja ocupa el bloque y un panel esmerilado lleva el selector
 * de periodo, el precio por mes, lo que se cobra cada vez, las viñetas y el
 * botón. En móvil el panel se encima al pie de la foto. El periodo
 * preseleccionado es el último (el más largo, el de mayor ahorro).
 */
function SubscriptionSection({ name, highlights, periods, availability, photo }: SubscriptionSectionProps) {
  const [selected, setSelected] = useState(periods.length - 1);
  const current = periods[selected];
  if (!current) return null;
  const { soldOut, note } = availability;

  return (
    <section aria-label="Suscripción" className="py-14 md:py-20">
      <div className="mx-auto max-w-shell px-4 md:px-8 xl:px-12">
        <div className="relative overflow-hidden rounded-md lg:flex lg:min-h-[36rem] lg:items-center">
          <BoxPhoto
            photo={photo}
            name={name}
            sizes="(min-width: 1280px) 1200px, 100vw"
            className="h-[26rem] lg:absolute lg:inset-0 lg:h-auto"
          />
          <div className="relative mx-3 -mt-20 rounded-md border border-border-strong bg-surface/90 p-6 backdrop-blur-xl backdrop-saturate-150 lg:m-10 lg:ml-auto lg:w-full lg:max-w-md lg:p-8">
            <h2 className="type-shop-card-title text-foreground">{name}</h2>
            <div className="mt-5">
              <PeriodPicker name="subscription-period" views={periods} selected={selected} onSelect={setSelected} />
            </div>
            <div aria-live="polite" className="mt-8">
              <p className="flex items-baseline gap-2">
                <span
                  className={`font-mono text-[56px] leading-none tabular-nums ${soldOut ? "text-muted-foreground-strong" : "text-foreground"}`}
                >
                  {formatPesos(current.perMonthCents)}
                </span>
                <span className="text-subtitle text-muted-foreground-strong">/ mes</span>
              </p>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-body text-foreground/80">
                {current.chargeLine}
                {current.savingsPercent > 0 ? (
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 type-shop-cta text-secondary-foreground">
                    Ahorras {current.savingsPercent} %
                  </span>
                ) : null}
              </p>
            </div>
            <HighlightsList items={highlights} className="mt-6 border-t border-border-strong pt-6" />
            {note ? (
              <p role="status" className="mt-6 text-body-sm text-foreground">
                {note}
              </p>
            ) : null}
            <SubscribeButton soldOut={soldOut} className="mt-6" />
          </div>
        </div>
      </div>
    </section>
  );
}

export { SubscriptionSection };
