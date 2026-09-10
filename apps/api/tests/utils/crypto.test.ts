import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generateRawToken, hashToken } from "../../src/utils/crypto.js";

describe("utils/crypto — cifrado AES-256-GCM at-rest", () => {
  it("cifra y descifra un secreto de vuelta a su valor original", () => {
    const plain = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptSecret(plain);
    expect(decryptSecret(encrypted)).toBe(plain);
  });

  it("produce un IV distinto en cada llamada (mismo texto, cifrado distinto)", () => {
    const plain = "mismo-secreto";
    const a = encryptSecret(plain);
    const b = encryptSecret(plain);
    expect(a).not.toBe(b);
  });

  it("el formato de salida es ivHex:authTagHex:cipherHex", () => {
    const encrypted = encryptSecret("secreto");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    const [iv, authTag] = parts;
    expect(iv).toMatch(/^[0-9a-f]{24}$/); // 12 bytes
    expect(authTag).toMatch(/^[0-9a-f]{32}$/); // 16 bytes
  });

  it("rechaza un payload con el authTag manipulado", () => {
    const encrypted = encryptSecret("secreto");
    const [iv, authTag, cipher] = encrypted.split(":");
    const tamperedTag = authTag!.slice(0, -2) + (authTag!.slice(-2) === "00" ? "ff" : "00");
    const tampered = `${iv}:${tamperedTag}:${cipher}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rechaza un payload con formato inválido", () => {
    expect(() => decryptSecret("no-es-un-payload-valido")).toThrow();
  });

  it("hashToken es determinista y de 64 caracteres hex (sha256)", () => {
    const raw = "un-token-crudo";
    const hashed = hashToken(raw);
    expect(hashed).toBe(hashToken(raw));
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generateRawToken produce valores distintos y suficientemente largos", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(48);
  });
});
