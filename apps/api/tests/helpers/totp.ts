import { authenticator } from "otplib";

const STEP_MS = 30_000;

/**
 * Código TOTP de un paso vecino al actual (`offset` -1, 0 o +1: la ventana que
 * acepta el servicio). Como el servicio rechaza reusar un paso ya aceptado
 * (anti-replay), un test que necesita dos códigos válidos seguidos de la misma
 * cuenta usa `0` y luego `1`, sin esperar 30 s reales.
 */
function totpAtOffset(secret: string, offset: -1 | 0 | 1 = 0): string {
  return authenticator.clone({ epoch: Date.now() + offset * STEP_MS }).generate(secret);
}

export { totpAtOffset };
