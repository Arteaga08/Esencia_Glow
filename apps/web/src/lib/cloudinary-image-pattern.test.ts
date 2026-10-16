import { matchRemotePattern } from "next/dist/shared/lib/match-remote-pattern";
import { describe, expect, it } from "vitest";
import { buildCloudinaryRemotePattern } from "./cloudinary-image-pattern";

// Auditoría run-2, hallazgo 14: el optimizador de imágenes aceptaba cualquier
// cuenta de res.cloudinary.com, así que un visitante podía meter sus propios
// bytes al decodificador. Se usa el mismo matcher que Next aplica en /_next/image.
describe("buildCloudinaryRemotePattern", () => {
  const pattern = buildCloudinaryRemotePattern("ozpexdfc");
  const matches = (url: string) => matchRemotePattern(pattern, new URL(url));

  it("acepta las imágenes de la cuenta de la tienda", () => {
    expect(matches("https://res.cloudinary.com/ozpexdfc/image/upload/v1/esencia-glow/production/hero.jpg")).toBe(true);
    expect(matches("https://res.cloudinary.com/ozpexdfc/image/upload/f_auto,q_auto/a.png")).toBe(true);
  });

  it("rechaza otras cuentas de Cloudinary y otros tipos de recurso", () => {
    expect(matches("https://res.cloudinary.com/otra-cuenta/image/upload/x.png")).toBe(false);
    expect(matches("https://res.cloudinary.com/ozpexdfc-falsa/image/upload/x.png")).toBe(false);
    expect(matches("https://res.cloudinary.com/ozpexdfc/image/fetch/https://ejemplo.com/x.png")).toBe(false);
    expect(matches("http://res.cloudinary.com/ozpexdfc/image/upload/x.png")).toBe(false);
  });

  it("falla si falta la cuenta o no tiene forma de nombre de cuenta", () => {
    expect(() => buildCloudinaryRemotePattern(undefined)).toThrow(/CLOUDINARY_CLOUD_NAME/);
    expect(() => buildCloudinaryRemotePattern("")).toThrow(/CLOUDINARY_CLOUD_NAME/);
    expect(() => buildCloudinaryRemotePattern("*")).toThrow(/CLOUDINARY_CLOUD_NAME/);
    expect(() => buildCloudinaryRemotePattern("a/b")).toThrow(/CLOUDINARY_CLOUD_NAME/);
  });
});
