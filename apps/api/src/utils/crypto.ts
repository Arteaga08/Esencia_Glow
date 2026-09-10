import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

/**
 * Cifrado AES-256-GCM at-rest para secretos que nunca deben quedar en texto
 * plano en DB (ej. secreto TOTP) y utilidades de hashing de tokens de un solo
 * uso (verificación de email, reset de contraseña, refresh token).
 *
 * Ver ~/.claude/standards/BACKEND_SECURITY_GUIDELINES.md §2: clave derivada
 * de ENCRYPTION_KEY vía sha256 (nunca hardcodeada), IV aleatorio de 12 bytes
 * en cada cifrado, formato de salida `ivHex:authTagHex:cipherHex`.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const RAW_TOKEN_LENGTH_BYTES = 32;

function deriveKey(): Buffer {
  return createHash("sha256").update(env.encryptionKey).digest();
}

function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, deriveKey(), iv);
  const cipherText = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${cipherText.toString("hex")}`;
}

function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato de payload cifrado inválido");
  }

  const [ivHex, authTagHex, cipherHex] = parts as [string, string, string];
  const decipher = createDecipheriv(ALGORITHM, deriveKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const plainText = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]);

  return plainText.toString("utf8");
}

/** sha256 hex de un token crudo — así el valor guardado en DB nunca es el usable. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Token opaco aleatorio para refresh tokens y tokens de un solo uso. */
function generateRawToken(): string {
  return randomBytes(RAW_TOKEN_LENGTH_BYTES).toString("hex");
}

export { decryptSecret, encryptSecret, generateRawToken, hashToken };
