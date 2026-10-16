import { EditionStatus } from "@esencia-glow/shared";
import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Product } from "../../src/models/product.model.js";
import { SubscriptionEdition } from "../../src/models/subscription-edition.model.js";
import { createEdition, updateEdition } from "../../src/services/subscription-edition.service.js";
import { publishEdition } from "../../src/services/subscription-edition-publish.service.js";
import { seedPlanWithStripeRefs, seedSubscriptionVariantWithStock } from "../helpers/subscription-fixtures.js";

/**
 * Auditoría run-2, hallazgo 19: `publishEdition` validaba una copia en memoria
 * de los ítems y luego reclamaba con un filtro que solo miraba `status`. Un
 * `PATCH` de ítems que cae entre la lectura y el claim (la edición sigue en
 * DRAFT, así que el PATCH procede) se publicaba SIN pasar por `assertPublishable`.
 */
describe("publishEdition — ítems cambiados entre la validación y el claim", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("responde 409 y deja la edición en DRAFT si los ítems cambian mientras se valida", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock();
    const edition = await createEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 11,
      title: "Noviembre",
    });
    const id = edition._id.toString();
    await updateEdition(id, {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });

    // Pausa `assertPublishable` justo en su consulta de productos (después de
    // que `publishEdition` ya leyó la edición, antes del claim).
    const realFind = Product.find.bind(Product);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reachedValidation!: () => void;
    const validating = new Promise<void>((resolve) => {
      reachedValidation = resolve;
    });
    let gated = false;
    vi.spyOn(Product, "find").mockImplementation(((...args: Parameters<typeof Product.find>) => {
      // Solo la PRIMERA consulta (la de la publicación) espera; el resto, intacto.
      if (gated) return realFind(...args);
      gated = true;
      return {
        select: () => ({
          lean: async () => {
            reachedValidation();
            await gate;
            return realFind(...args).select("variants channel status").lean();
          },
        }),
      };
    }) as unknown as typeof Product.find);

    const publishing = publishEdition(id, new Types.ObjectId().toString());
    const outcome = publishing.then(
      () => "published" as const,
      (error: { statusCode?: number }) => error,
    );

    await validating;
    // El admin vacía los ítems en otra pestaña: la edición sigue en DRAFT.
    await updateEdition(id, { items: [] });
    release();

    const result = await outcome;
    expect(result).toMatchObject({ statusCode: 409 });

    const stored = await SubscriptionEdition.findById(id).lean();
    expect(stored?.status).toBe(EditionStatus.DRAFT);
    expect(stored?.items).toHaveLength(0);
  });

  it("publica normalmente cuando nada cambia durante la validación", async () => {
    const plan = await seedPlanWithStripeRefs();
    const { product, variantId } = await seedSubscriptionVariantWithStock();
    const edition = await createEdition({
      planId: plan._id.toString(),
      cycleYear: 2026,
      cycleMonth: 12,
      title: "Diciembre",
    });
    const id = edition._id.toString();
    await updateEdition(id, {
      items: [{ productId: product._id.toString(), variantId: variantId.toString(), quantity: 1 }],
    });

    const published = await publishEdition(id, new Types.ObjectId().toString());
    expect(published.status).toBe(EditionStatus.PUBLISHED);
  });
});
