"use client";

import { useState } from "react";
import { MAX_BUNDLE_QUANTITY } from "@esencia-glow/shared";
import { FieldError } from "@/components/ui/field-error";
import { describeAddOutcome } from "@/lib/storefront/cart/add-outcome-copy";
import type { CartItemInput } from "@/lib/storefront/cart/cart-store";
import type { KitView } from "@/lib/storefront/kit-view";
import { AddToCartButton } from "@/components/storefront/product/add-to-cart-button";
import { ProductHeading } from "@/components/storefront/product/product-heading";
import { QuantityStepper } from "@/components/storefront/product/quantity-stepper";

/**
 * Columna de compra de un kit: un precio manual y una cantidad, sin selector
 * de presentación. Si el kit no se puede armar hoy, el botón queda apagado y
 * una línea pegada a él lo explica (sin decir qué pieza falta).
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

  return (
    <div className="flex flex-col gap-6">
      <ProductHeading
        badge={kit.badge}
        name={kit.name}
        priceCents={kit.priceCents}
        listPriceCents={kit.listPriceCents}
        available={kit.available}
      />
      <p className="max-w-[65ch] text-body text-foreground/80">{kit.description}</p>

      <div className="flex gap-3">
        <QuantityStepper
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
          className="flex-1"
        />
      </div>
      {!kit.available ? (
        <FieldError message="Uno o más productos de este kit no están disponibles por ahora." />
      ) : limitNotice ? (
        <FieldError message={limitNotice} />
      ) : null}
    </div>
  );
}

export { KitPurchasePanel };
