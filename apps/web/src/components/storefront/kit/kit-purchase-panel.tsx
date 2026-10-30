"use client";

import { useState } from "react";
import { MAX_BUNDLE_QUANTITY } from "@esencia-glow/shared";
import { FieldError } from "@/components/ui/field-error";
import { describeAddOutcome } from "@/lib/storefront/cart/add-outcome-copy";
import type { CartItemInput } from "@/lib/storefront/cart/cart-store";
import { CHECKOUT_MODE } from "@/lib/storefront/checkout/checkout-mode";
import type { KitView } from "@/lib/storefront/kit-view";
import { AddToCartButton } from "@/components/storefront/product/add-to-cart-button";
import { BenefitTags } from "@/components/storefront/product/benefit-tags";
import { DeliveryInfo } from "@/components/storefront/product/delivery-info";
import { ProductHeading } from "@/components/storefront/product/product-heading";
import { PurchaseAssurances } from "@/components/storefront/product/purchase-assurances";
import { QuantityStepper } from "@/components/storefront/product/quantity-stepper";
import { SaveButton } from "@/components/storefront/product/save-button";

/**
 * Columna de compra de un kit: un precio manual y una cantidad, sin selector
 * de presentación. Por lo demás es la misma que la de producto (beneficios,
 * guardar, entrega y garantías). Si el kit no se puede armar hoy, el botón
 * queda apagado y una línea pegada a él lo explica (sin decir qué pieza falta).
 */
function KitPurchasePanel({ kit }: { kit: KitView }) {
  const [quantity, setQuantity] = useState(1);
  // Aviso de tope del carrito, pegado a la fila de compra.
  const [limitNotice, setLimitNotice] = useState<string | null>(null);

  const cartItem: CartItemInput = {
    itemType: "bundle",
    itemId: kit.id,
    snapshot: {
      name: kit.name,
      variantLabel: kit.unitsLabel,
      priceCents: kit.priceCents,
      ...(kit.listPriceCents ? { listPriceCents: kit.listPriceCents } : {}),
      ...(kit.images[0] ? { image: { url: kit.images[0].url, alt: kit.images[0].alt } } : {}),
      slug: kit.slug,
    },
  };

  const benefits = kit.sections.find((section) => section.key === "benefits");

  return (
    <div className="flex flex-col gap-6">
      <ProductHeading
        badge={kit.badge}
        name={kit.name}
        priceCents={kit.priceCents}
        listPriceCents={kit.listPriceCents}
        available={kit.available}
      />
      <BenefitTags section={benefits} />
      <p className="max-w-[65ch] text-body text-foreground/80">{kit.description}</p>

      <div className="flex flex-wrap justify-between gap-3 sm:flex-nowrap">
        <QuantityStepper
          size="lg"
          value={quantity}
          max={MAX_BUNDLE_QUANTITY}
          onChange={(next) => {
            setQuantity(next);
            setLimitNotice(null);
          }}
        />
        <AddToCartButton
          item={cartItem}
          quantity={quantity}
          onResult={(result) => setLimitNotice(describeAddOutcome(result.outcome, "bundle"))}
          totalCents={kit.priceCents * quantity}
          available={kit.available}
          ariaLabel={`Agregar ${quantity} ${kit.name}`}
          size="lg"
          className="order-last basis-full sm:order-none sm:flex-1 sm:basis-0"
        />
        <SaveButton size="lg" itemType="bundle" itemId={kit.id} slug={kit.slug} name={kit.name} />
      </div>
      {!kit.available ? (
        <FieldError message="Uno o más productos de este kit no están disponibles por ahora." />
      ) : limitNotice ? (
        <FieldError message={limitNotice} />
      ) : null}
      {CHECKOUT_MODE === "whatsapp" ? <DeliveryInfo /> : null}
      <PurchaseAssurances />
    </div>
  );
}

export { KitPurchasePanel };
