import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

/**
 * Cliente perezoso de Cloudinary, mismo patrón que config/resend.ts: no
 * lanza al importarse (las credenciales pueden faltar en dev), solo cuando
 * de verdad se intenta usar sin configurar — y ahí responde 503, nunca finge
 * éxito (ver services/media-provider.ts).
 */
let configured = false;

function isCloudinaryConfigured(): boolean {
  return Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
}

function getCloudinary(): typeof cloudinary | undefined {
  if (!isCloudinaryConfigured()) return undefined;

  if (!configured) {
    cloudinary.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: env.cloudinaryApiKey,
      api_secret: env.cloudinaryApiSecret,
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
}

export { getCloudinary, isCloudinaryConfigured };
