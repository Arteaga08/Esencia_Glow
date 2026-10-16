/**
 * Patrón de `images.remotePatterns` para el optimizador de Next (auditoría
 * run-2, hallazgo 14). `res.cloudinary.com` lo comparten TODAS las cuentas de
 * Cloudinary: permitir solo el hostname dejaba que cualquier visitante pidiera
 * `/_next/image` con una foto subida a su propia cuenta y metiera sus bytes al
 * decodificador del servidor. Se amarra a `/<cuenta>/image/upload/**`: solo
 * las fotos que sube el panel (el tipo `fetch` de Cloudinary, que trae
 * imágenes de cualquier URL, queda fuera).
 *
 * El nombre de la cuenta solo admite letras, números, `-` y `_`: es un glob
 * de Next, y un `*` o una `/` volverían a abrir el patrón.
 */
const CLOUD_NAME_PATTERN = /^[a-z0-9_-]+$/i;

interface CloudinaryRemotePattern {
  protocol: "https";
  hostname: string;
  pathname: string;
}

function buildCloudinaryRemotePattern(cloudName: string | undefined): CloudinaryRemotePattern {
  if (!cloudName || !CLOUD_NAME_PATTERN.test(cloudName)) {
    throw new Error(
      "CLOUDINARY_CLOUD_NAME falta o no es un nombre de cuenta válido (mismo valor que en apps/api).",
    );
  }
  return { protocol: "https", hostname: "res.cloudinary.com", pathname: `/${cloudName}/image/upload/**` };
}

export { buildCloudinaryRemotePattern };
export type { CloudinaryRemotePattern };
