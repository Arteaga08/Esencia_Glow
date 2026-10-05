"use client";

import { useState } from "react";
import type { ProductView } from "@/lib/storefront/product-view";
import { AddToCartButton } from "./add-to-cart-button";
import { BenefitTags } from "./benefit-tags";
import { ProductHeading } from "./product-heading";
import { QuantityStepper } from "./quantity-stepper";
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

  const variant = product.variants.find((candidate) => candidate.id === variantId) ?? firstAvailable;
  if (!variant) return null;

  const benefits = product.sections.find((section) => section.key === "benefits");

  return (
    <div className="flex flex-col gap-6">
      <ProductHeading product={product} variant={variant} />
      <BenefitTags section={benefits} />
      <SkinTypes types={product.skinTypes} />
      <p className="max-w-[65ch] text-body text-foreground/80">{product.description}</p>

      {product.variants.length > 1 ? (
        <VariantPicker variants={product.variants} selectedId={variant.id} onSelect={setVariantId} />
      ) : null}

      <div className="flex gap-3">
        <QuantityStepper value={quantity} onChange={setQuantity} />
        <AddToCartButton
          totalCents={variant.priceCents * quantity}
          available={variant.available}
          ariaLabel={`Agregar ${quantity} ${product.name}, ${variant.label}`}
          className="flex-1"
        />
      </div>
    </div>
  );
}

export { PurchasePanel };
