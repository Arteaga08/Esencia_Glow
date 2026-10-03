/**
 * Redes y fotos del bloque "Redes sociales" del home. Todo vive en código a
 * propósito: para cambiar una foto o un perfil se edita este archivo (las fotos
 * van por Cloudinary). Las URLs de abajo son PROVISIONALES: fotos de desarrollo
 * que ya existen en el catálogo y el home; reemplazar por las reales.
 */

type SocialNetworkKey = "instagram" | "tiktok" | "facebook";

interface SocialNetwork {
  key: SocialNetworkKey;
  label: string;
  handle: string;
  href: string;
}

interface SocialPhoto {
  url: string;
  alt: string;
  /** Destino al tocar la foto: por ahora el perfil, no un post concreto. */
  href: string;
}

const PROFILE = "https://www.instagram.com/esenciaglow";
const SOCIAL_HANDLE = "@esenciaglow";
const SOCIAL_HASHTAG = "#EsenciaGlow";

const SOCIAL_NETWORKS: SocialNetwork[] = [
  { key: "instagram", label: "Instagram", handle: SOCIAL_HANDLE, href: PROFILE },
  { key: "tiktok", label: "TikTok", handle: SOCIAL_HANDLE, href: "https://www.tiktok.com/@esenciaglow" },
  { key: "facebook", label: "Facebook", handle: "Esencia Glow", href: "https://www.facebook.com/esenciaglow" },
];

const CLOUD = "https://res.cloudinary.com/ozpexdfc/image/upload";

const SOCIAL_PHOTOS: SocialPhoto[] = [
  { url: `${CLOUD}/v1790960999/esencia-glow/development/home/s7cyibcseqatd88224kn.webp`, alt: "Rutina de skincare compartida en Instagram", href: PROFILE },
  { url: `${CLOUD}/v1790368068/esencia-glow/development/products/jrl3d5aze8krexguious.webp`, alt: "Producto Esencia Glow en la publicación de una clienta", href: PROFILE },
  { url: `${CLOUD}/v1790368198/esencia-glow/development/products/lx3enb6fdykvewiwkhjs.webp`, alt: "Producto Esencia Glow sobre el tocador", href: PROFILE },
  { url: `${CLOUD}/v1790960995/esencia-glow/development/home/tdfokir8rnzg4zjadgh3.webp`, alt: "Caja de suscripción abierta", href: PROFILE },
  { url: `${CLOUD}/v1790368215/esencia-glow/development/products/fla0znmph92cnqbq0qs1.webp`, alt: "Producto Esencia Glow en uso", href: PROFILE },
  { url: `${CLOUD}/v1790368224/esencia-glow/development/products/zu9zkz92rjgckajzh5cx.webp`, alt: "Detalle de un producto Esencia Glow", href: PROFILE },
  { url: `${CLOUD}/v1790368236/esencia-glow/development/products/lzre4ju8bxd1x0mv8sci.webp`, alt: "Producto Esencia Glow junto a flores", href: PROFILE },
  { url: `${CLOUD}/v1790368255/esencia-glow/development/products/u3cjjxbbrnfp8pcofdpf.webp`, alt: "Producto Esencia Glow en la regadera", href: PROFILE },
];

export { SOCIAL_HANDLE, SOCIAL_HASHTAG, SOCIAL_NETWORKS, SOCIAL_PHOTOS };
export type { SocialNetwork, SocialNetworkKey, SocialPhoto };
