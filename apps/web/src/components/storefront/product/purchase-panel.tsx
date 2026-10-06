"use client";

import { useState } from "react";
import { FieldError } from "@/components/ui/field-error";
import { describeAddOutcome } from "@/lib/storefront/cart/add-outcome-copy";
import type { CartItemInput } from "@/lib/storefront/cart/cart-store";
import type { ProductView } from "@/lib/storefront/product-view";
import { AddToCartButton } from "./add-to-cart-button";
import { BenefitTags } from "./benefit-tags";
import { ProductHeading } from "./product-heading";
import { QuantityStepper } from "./quantity-stepper";
import { SaveButton } from "./save-button";
import { SkinTypes } from "./skin-types";
import { VariantPicker } from "./variant-picker";

/**
 * Columna de compra: junta presentación, cantidad y botón en un solo estado.
 * Arranca en la primera presentación disponible; con una sola presentación no
 * hay selector.
 */
function PurchasePanel({ product }: { product: ProductView }) {
  const firstAvailable = product.variants.find((variant) => variant.available) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  // Aviso de tope del carrito, pegado a la fila de compra.
  const [limitNotice, setLimitNotice] = useState<string | null>(null);

  const variant = product.variants.find((candidate) => candidate.id === variantId) ?? firstAvailable;
  if (!variant) return null;

  const cartItem: CartItemInput = {
    itemType: "product",
    itemId: variant.id,
    snapshot: {
      name: product.name,
      ...(product.brand ? { brand: product.brand } : {}),
      variantLabel: variant.label,
      priceCents: variant.priceCents,
      ...(variant.listPriceCents ? { listPriceCents: variant.listPriceCents } : {}),
      ...(product.images[0] ? { image: { url: product.images[0].url, alt: product.images[0].alt } } : {}),
      slug: product.slug,
    },
  };

  const benefits = product.sections.find((section) => section.key === "benefits");

  return (
    <div className="flex flex-col gap-6">
      <ProductHeading product={product} variant={variant} />
      <BenefitTags section={benefits} />
      <SkinTypes types={product.skinTypes} />
      <p className="max-w-[65ch] text-body text-foreground/80">{product.description}</p>

      {product.variants.length > 1 ? (
        <VariantPicker
          variants={product.variants}
          selectedId={variant.id}
          onSelect={(id) => {
            setVariantId(id);
            setLimitNotice(null);
          }}
        />
      ) : null}

      <div className="flex gap-3">
        <QuantityStepper
          value={quantity}
          onChange={(next) => {
            setQuantity(next);
            setLimitNotice(null);
          }}
        />
        <AddToCartButton
          item={cartItem}
          quantity={quantity}
          onResult={(result) => setLimitNotice(describeAddOutcome(result.outcome, "product"))}
          totalCents={variant.priceCents * quantity}
          available={variant.available}
          ariaLabel={`Agregar ${quantity} ${product.name}, ${variant.label}`}
          className="flex-1"
        />
        <SaveButton productId={product.id} slug={product.slug} name={product.name} />
      </div>
      {limitNotice ? <FieldError message={limitNotice} /> : null}
    </div>
  );
}

export { PurchasePanel };
