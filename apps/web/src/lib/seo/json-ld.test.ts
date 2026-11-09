import { describe, expect, it } from "vitest";
import { absoluteUrl, SITE_URL } from "./site-url";
import { buildBreadcrumbJsonLd, buildProductJsonLd, serializeJsonLd } from "./json-ld";

describe("absoluteUrl", () => {
  it("antepone el dominio y deja la raíz sin barra final", () => {
    expect(absoluteUrl("/producto/x")).toBe(`${SITE_URL}/producto/x`);
    expect(absoluteUrl("producto/x")).toBe(`${SITE_URL}/producto/x`);
    expect(absoluteUrl("/")).toBe(SITE_URL);
  });
});

describe("buildProductJsonLd", () => {
  const base = { name: "Limpiador", description: "Espuma suave", path: "/producto/limpiador", imageUrls: [] };

  it("una sola variante: Offer en MXN con precio en pesos", () => {
    const data = buildProductJsonLd({ ...base, variants: [{ priceCents: 34900, available: true }] });
    expect(data.offers).toMatchObject({ "@type": "Offer", priceCurrency: "MXN", price: "349.00", availability: "https://schema.org/InStock" });
  });

  it("precios distintos: AggregateOffer con rango", () => {
    const data = buildProductJsonLd({ ...base, variants: [{ priceCents: 20000, available: false }, { priceCents: 35050, available: true }] });
    expect(data.offers).toMatchObject({ "@type": "AggregateOffer", lowPrice: "200.00", highPrice: "350.50", offerCount: 2, availability: "https://schema.org/InStock" });
  });

  it("todo agotado: OutOfStock", () => {
    const data = buildProductJsonLd({ ...base, variants: [{ priceCents: 1000, available: false }] });
    expect(data.offers).toMatchObject({ availability: "https://schema.org/OutOfStock" });
  });

  it("sin variantes, marca ni fotos no declara oferta, marca ni imagen", () => {
    const data = buildProductJsonLd({ ...base, variants: [] });
    expect(data).not.toHaveProperty("offers");
    expect(data).not.toHaveProperty("brand");
    expect(data).not.toHaveProperty("image");
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("numera desde 1 y vuelve absolutas las rutas", () => {
    const data = buildBreadcrumbJsonLd([{ name: "Inicio", path: "/" }, { name: "Rostro", path: "/categoria/rostro" }]);
    expect(data.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Rostro", item: `${SITE_URL}/categoria/rostro` },
    ]);
  });
});

describe("serializeJsonLd", () => {
  it("escapa </script> para que un texto del panel no cierre la etiqueta", () => {
    const out = serializeJsonLd({ description: "</script><script>alert(1)</script> & más" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(JSON.parse(out).description).toBe("</script><script>alert(1)</script> & más");
  });
});
