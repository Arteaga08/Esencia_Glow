import { describe, expect, it } from "vitest";
import { detectImageMime } from "../../src/utils/image-signature.js";

describe("utils/image-signature — detección por magic bytes", () => {
  it("detecta un JPEG válido", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectImageMime(buffer)).toBe("image/jpeg");
  });

  it("detecta un PNG válido", () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(detectImageMime(buffer)).toBe("image/png");
  });

  it("detecta un WEBP válido (RIFF + WEBP)", () => {
    const buffer = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP", "ascii"),
    ]);
    expect(detectImageMime(buffer)).toBe("image/webp");
  });

  it("un texto plano con nombre .png sigue sin ser una imagen", () => {
    const buffer = Buffer.from("no soy una imagen, solo texto plano");
    expect(detectImageMime(buffer)).toBeUndefined();
  });

  it("un SVG (HTML ejecutable) queda fuera por construcción", () => {
    const buffer = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    expect(detectImageMime(buffer)).toBeUndefined();
  });

  it("un PDF no es una imagen aceptada", () => {
    const buffer = Buffer.from("%PDF-1.4\n%comentario");
    expect(detectImageMime(buffer)).toBeUndefined();
  });

  it("RIFF + WAVE (no WEBP) no pasa como imagen", () => {
    const buffer = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WAVE", "ascii"),
    ]);
    expect(detectImageMime(buffer)).toBeUndefined();
  });

  it("un buffer más corto que cualquier firma no revienta y devuelve undefined", () => {
    expect(detectImageMime(Buffer.from([0x01, 0x02]))).toBeUndefined();
  });
});
