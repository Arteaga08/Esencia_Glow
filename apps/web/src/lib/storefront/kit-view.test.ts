import type { PublicBundle } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { splitItemName, toKitView } from "./kit-view";

const IMAGE = { id: "i1", url: "https://cdn.example.com/a.jpg", width: 800, height: 1000 };

function bundle(overrides: Partial<PublicBundle> = {}): PublicBundle {
  return {
    id: "b1",
    name: "Rutina Completa",
    slug: "rutina-completa",
    description: "Set de skincare",
    images: [],
    price: 99900,
    currency: "MXN",
    items: [
      { productId: "p1", productSlug: "serum-c", variantId: "v1", name: "Sérum C \u2014 30 ml", attributes: {}, quantity: 2, image: IMAGE },
      { productId: "p2", variantId: "v2", name: "Crema \u2014 50 ml", attributes: {}, quantity: 1 },
    ],
    ...overrides,
  } as PublicBundle;
}

describe("splitItemName", () => {
  it("separa nombre y presentación", () => {
    expect(splitItemName("Sérum C \u2014 30 ml")).toEqual({ name: "Sérum C", presentation: "30 ml" });
  });

  it("corta en el último separador si el nombre ya lo trae", () => {
    expect(splitItemName("Mist \u2014 Rosas \u2014 100 ml")).toEqual({ name: "Mist \u2014 Rosas", presentation: "100 ml" });
  });

  it("sin separador todo es nombre", () => {
    expect(splitItemName("Producto no disponible")).toEqual({ name: "Producto no disponible", presentation: "" });
  });
});

describe("toKitView", () => {
  it("cuenta unidades y enlaza solo las piezas con slug", () => {
    const view = toKitView(bundle());
    expect(view.unitsLabel).toBe("3 productos");
    expect(view.items[0]).toMatchObject({ name: "Sérum C", presentation: "30 ml", quantity: 2, href: "/producto/serum-c" });
    expect(view.items[1]!.href).toBeUndefined();
  });

  it("usa singular con una sola unidad", () => {
    const view = toKitView(bundle({ items: [{ productId: "p1", variantId: "v1", name: "Sérum \u2014 30 ml", attributes: {}, quantity: 1 }] }));
    expect(view.unitsLabel).toBe("1 producto");
  });

  it("completa las fotos con las de sus piezas cuando el kit no tiene propias", () => {
    expect(toKitView(bundle()).images).toHaveLength(1);
    const own = { ...IMAGE, url: "https://cdn.example.com/kit.jpg" };
    const view = toKitView(bundle({ images: [own] }));
    expect(view.images.map((image) => image.url)).toEqual([own.url]);
  });

  it("el precio de lista solo se muestra si es mayor que el precio", () => {
    expect(toKitView(bundle({ listPrice: 129900 })).listPriceCents).toBe(129900);
    expect(toKitView(bundle({ listPrice: 99900 })).listPriceCents).toBeUndefined();
    expect(toKitView(bundle({ listPrice: null })).listPriceCents).toBeUndefined();
  });

  it("sin dato de disponibilidad se asume disponible", () => {
    expect(toKitView(bundle()).available).toBe(true);
    expect(toKitView(bundle(), false).available).toBe(false);
  });

  it("solo incluye los bloques de contenido que traen algo", () => {
    const view = toKitView(bundle({ content: { benefits: [{ title: "Hidrata", text: "Piel suave" }], usage: [] } }));
    expect(view.sections.map((section) => section.key)).toEqual(["benefits"]);
  });
});
