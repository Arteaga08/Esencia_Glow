import { describe, expect, it } from "vitest";
import { parsePublishableKey } from "./stripe-config";

describe("parsePublishableKey", () => {
  it("acepta una llave publicable", () => {
    expect(parsePublishableKey("pk_test_abc123")).toBe("pk_test_abc123");
    expect(parsePublishableKey("  pk_live_xyz ")).toBe("pk_live_xyz");
  });

  it("rechaza vacío, ausente y cualquier cosa que no sea publicable (nunca una llave secreta)", () => {
    expect(parsePublishableKey(undefined)).toBeNull();
    expect(parsePublishableKey("")).toBeNull();
    expect(parsePublishableKey("sk_test_secreta")).toBeNull();
    expect(parsePublishableKey("rk_live_restringida")).toBeNull();
  });
});
