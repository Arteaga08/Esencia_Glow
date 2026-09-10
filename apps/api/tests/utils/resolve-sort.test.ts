import { describe, expect, it } from "vitest";
import { resolveSort } from "../../src/utils/resolve-sort.js";

const ALLOWED = ["createdAt", "name", "minPrice"] as const;

describe("utils/resolve-sort", () => {
  it("respeta un campo permitido en ascendente", () => {
    expect(resolveSort({ field: "name", direction: "asc" }, ALLOWED, "createdAt")).toEqual({
      name: 1,
      _id: 1,
    });
  });

  it("respeta un campo permitido en descendente", () => {
    expect(resolveSort({ field: "minPrice", direction: "desc" }, ALLOWED, "createdAt")).toEqual({
      minPrice: -1,
      _id: -1,
    });
  });

  it("un campo fuera de la whitelist cae al fallback", () => {
    expect(resolveSort({ field: "password", direction: "asc" }, ALLOWED, "createdAt")).toEqual({
      createdAt: 1,
      _id: 1,
    });
  });

  it("un intento de prototype pollution también cae al fallback", () => {
    expect(resolveSort({ field: "__proto__", direction: "desc" }, ALLOWED, "createdAt")).toEqual({
      createdAt: -1,
      _id: -1,
    });
  });
});
