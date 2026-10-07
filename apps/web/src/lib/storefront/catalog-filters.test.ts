import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG_FILTERS, catalogFiltersToApiParams, kitFiltersToApiParams } from "./catalog-filters";

describe("kitFiltersToApiParams", () => {
  it("sin filtros pide lo más nuevo y nada más", () => {
    expect(kitFiltersToApiParams(DEFAULT_CATALOG_FILTERS)).toEqual({ sort: "-createdAt" });
  });

  it("ordena por precio con el campo de los paquetes, no el de los productos", () => {
    const params = kitFiltersToApiParams({ ...DEFAULT_CATALOG_FILTERS, sort: "price-asc" });
    expect(params.sort).toBe("price");
    expect(catalogFiltersToApiParams({ ...DEFAULT_CATALOG_FILTERS, sort: "price-asc" }).sort).toBe("minPrice");
  });

  it("convierte pesos a centavos y nunca manda marcas", () => {
    const params = kitFiltersToApiParams({ brands: ["Cosrx"], min: "250", max: "399.50", sort: "newest" });
    expect(params).toEqual({ sort: "-createdAt", minPrice: "25000", maxPrice: "39950" });
  });
});
