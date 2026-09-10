/**
 * Detecta el tipo real de una imagen por sus primeros bytes (magic bytes),
 * nunca por la extensión del archivo ni el Content-Type declarado — ambos los
 * controla el cliente y no prueban nada sobre el contenido
 * (BACKEND_SECURITY_GUIDELINES.md §5). Los formatos aceptados son una lista
 * cerrada por diseño: JPEG, PNG y WEBP. SVG queda fuera a propósito, es HTML
 * ejecutable.
 */

type AllowedImageMime = "image/jpeg" | "image/png" | "image/webp";

const ALLOWED_IMAGE_MIMES: readonly AllowedImageMime[] = ["image/jpeg", "image/png", "image/webp"];

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function matchesSignature(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) return false;
  return signature.every((byte, index) => buffer[offset + index] === byte);
}

/**
 * WEBP es un contenedor RIFF: "RIFF" en los primeros 4 bytes no basta (un
 * .wav también empieza así), hay que confirmar "WEBP" en los bytes 8..11.
 */
function isWebp(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);
  return riff === "RIFF" && webp === "WEBP";
}

function detectImageMime(buffer: Buffer): AllowedImageMime | undefined {
  if (matchesSignature(buffer, JPEG_SIGNATURE)) return "image/jpeg";
  if (matchesSignature(buffer, PNG_SIGNATURE)) return "image/png";
  if (isWebp(buffer)) return "image/webp";
  return undefined;
}

export { detectImageMime, ALLOWED_IMAGE_MIMES };
export type { AllowedImageMime };
