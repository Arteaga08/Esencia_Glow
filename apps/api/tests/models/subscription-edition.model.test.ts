import mongoose from "mongoose";
import { EditionStatus, MAX_EDITION_ITEMS } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { SubscriptionEdition } from "../../src/models/subscription-edition.model.js";

function buildEditionAttrs(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    planId: new mongoose.Types.ObjectId(),
    cycleYear: 2026,
    cycleMonth: 9,
    title: "Esencial · Septiembre",
    ...overrides,
  };
}

function buildItem() {
  return { productId: new mongoose.Types.ObjectId(), variantId: new mongoose.Types.ObjectId(), quantity: 1 };
}

describe("models/SubscriptionEdition", () => {
  it("crea una edición válida vacía, en DRAFT por default", async () => {
    const edition = await SubscriptionEdition.create(buildEditionAttrs());
    expect(edition.status).toBe(EditionStatus.DRAFT);
    expect(edition.items).toHaveLength(0);
  });

  it("rechaza dos ediciones del mismo plan y ciclo (11000)", async () => {
    const planId = new mongoose.Types.ObjectId();
    await SubscriptionEdition.create(buildEditionAttrs({ planId, cycleYear: 2026, cycleMonth: 9 }));

    await expect(
      SubscriptionEdition.create(buildEditionAttrs({ planId, cycleYear: 2026, cycleMonth: 9 })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("una edición DRAFT y otra PUBLISHED del mismo plan y ciclo también chocan (el unique es incondicional)", async () => {
    const planId = new mongoose.Types.ObjectId();
    await SubscriptionEdition.create(
      buildEditionAttrs({ planId, cycleYear: 2026, cycleMonth: 9, status: EditionStatus.PUBLISHED, items: [buildItem()] }),
    );

    await expect(
      SubscriptionEdition.create(buildEditionAttrs({ planId, cycleYear: 2026, cycleMonth: 9, status: EditionStatus.DRAFT })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("permite el mismo ciclo en planes distintos", async () => {
    await SubscriptionEdition.create(buildEditionAttrs({ cycleYear: 2026, cycleMonth: 9 }));
    await expect(
      SubscriptionEdition.create(buildEditionAttrs({ cycleYear: 2026, cycleMonth: 9 })),
    ).resolves.toBeDefined();
  });

  it("permite el mismo plan en ciclos distintos", async () => {
    const planId = new mongoose.Types.ObjectId();
    await SubscriptionEdition.create(buildEditionAttrs({ planId, cycleYear: 2026, cycleMonth: 9 }));
    await expect(
      SubscriptionEdition.create(buildEditionAttrs({ planId, cycleYear: 2026, cycleMonth: 10 })),
    ).resolves.toBeDefined();
  });

  it("rechaza cycleMonth fuera de 1-12", async () => {
    await expect(SubscriptionEdition.create(buildEditionAttrs({ cycleMonth: 13 }))).rejects.toThrow();
    await expect(SubscriptionEdition.create(buildEditionAttrs({ cycleMonth: 0 }))).rejects.toThrow();
  });

  it(`rechaza más de ${MAX_EDITION_ITEMS} items`, async () => {
    const items = Array.from({ length: MAX_EDITION_ITEMS + 1 }, buildItem);
    await expect(SubscriptionEdition.create(buildEditionAttrs({ items }))).rejects.toThrow();
  });

  it(`acepta exactamente ${MAX_EDITION_ITEMS} items`, async () => {
    const items = Array.from({ length: MAX_EDITION_ITEMS }, buildItem);
    const edition = await SubscriptionEdition.create(buildEditionAttrs({ items }));
    expect(edition.items).toHaveLength(MAX_EDITION_ITEMS);
  });
});
