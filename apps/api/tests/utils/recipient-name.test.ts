import { describe, expect, it } from "vitest";
import { joinRecipientName } from "../../src/utils/recipient-name.js";

describe("utils/recipient-name", () => {
  it("une nombre y apellidos con un espacio", () => {
    expect(joinRecipientName("María", "López Hernández")).toBe("María López Hernández");
  });

  it("recorta espacios sobrantes de cada parte", () => {
    expect(joinRecipientName("  María ", " López  ")).toBe("María López");
  });
});
