import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPasswordBreached } from "../../src/services/password-breach.service.js";

/**
 * Consulta k-anonymity a Pwned Passwords: solo viajan los 5 primeros
 * caracteres del SHA-1, nunca la contraseña ni el hash completo.
 */

const PASSWORD = "Contrasena1";
const SHA1 = createHash("sha1").update(PASSWORD).digest("hex").toUpperCase();
const PREFIX = SHA1.slice(0, 5);
const SUFFIX = SHA1.slice(5);

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn().mockImplementation(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("services/password-breach", () => {
  it("manda solo el prefijo de 5 caracteres y detecta el sufijo en la respuesta", async () => {
    const fetchMock = stubFetch(new Response(`AAAAA11111111111111111111111111111111:3\r\n${SUFFIX}:42\r\n`));

    expect(await isPasswordBreached(PASSWORD)).toBe(true);

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${PREFIX}`);
    expect(url).not.toContain(SUFFIX);
  });

  it("una contraseña que no aparece no se considera filtrada", async () => {
    stubFetch(new Response("AAAAA11111111111111111111111111111111:3\r\n"));
    expect(await isPasswordBreached(PASSWORD)).toBe(false);
  });

  it("las filas de relleno (conteo 0) no cuentan como coincidencia", async () => {
    stubFetch(new Response(`${SUFFIX}:0\r\n`));
    expect(await isPasswordBreached(PASSWORD)).toBe(false);
  });

  it("si el servicio no responde, falla abierto: no bloquea el registro", async () => {
    stubFetch(new Error("network down"));
    expect(await isPasswordBreached(PASSWORD)).toBe(false);
  });

  it("si responde con error HTTP, también falla abierto", async () => {
    stubFetch(new Response("boom", { status: 503 }));
    expect(await isPasswordBreached(PASSWORD)).toBe(false);
  });
});
