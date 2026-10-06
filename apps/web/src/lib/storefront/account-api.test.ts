import { ErrorCode } from "@esencia-glow/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "../api";

vi.mock("../config", () => ({ API_URL: "http://api.test" }));
vi.mock("../api", async (importOriginal) => ({ ...(await importOriginal<typeof ApiModule>()), apiRequest: vi.fn() }));
vi.mock("./session-hint", () => ({ clearAnonymous: vi.fn() }));

import { ApiRequestError, apiRequest } from "../api";
import { accountRequest } from "./account-api";
import { clearAnonymous } from "./session-hint";

const REFRESH = "/api/v1/auth/refresh";
const DATA = "/api/v1/account";

const mockedApi = vi.mocked(apiRequest);

function unauthorized(code?: ErrorCode) {
  return new ApiRequestError(401, { status: "fail", message: "No autenticado", ...(code ? { code } : {}) });
}

interface Backend {
  /** Cuántas veces se pidió cada ruta. */
  calls: Record<string, number>;
}

/** Simula el API: los datos dan 401 hasta que se refresca; el refresco responde `refreshOk`. */
function fakeBackend({ refreshOk = true, dataError }: { refreshOk?: boolean; dataError?: ApiRequestError } = {}): Backend {
  const backend: Backend = { calls: {} };
  let refreshed = false;
  mockedApi.mockImplementation((async (path: string) => {
    backend.calls[path] = (backend.calls[path] ?? 0) + 1;
    if (path === REFRESH) {
      await Promise.resolve();
      if (!refreshOk) throw unauthorized();
      refreshed = true;
      return { status: "success", message: "OK", data: null };
    }
    if (dataError) throw dataError;
    if (!refreshed) throw unauthorized();
    return { status: "success", message: "OK", data: { path } };
  }) as unknown as typeof apiRequest);
  return backend;
}

let assign: ReturnType<typeof vi.fn>;
let storage: Map<string, string>;
let lockRequests: string[];

function stubBrowser({ withLocks = true, beforeLockRun }: { withLocks?: boolean; beforeLockRun?: () => void } = {}) {
  assign = vi.fn();
  storage = new Map();
  lockRequests = [];
  vi.stubGlobal("window", {
    location: { pathname: "/mi-cuenta/perfil", search: "?x=1", assign },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value) },
  });
  vi.stubGlobal("navigator", {
    ...(withLocks
      ? {
          locks: {
            request: async (name: string, callback: () => Promise<unknown>) => {
              lockRequests.push(name);
              beforeLockRun?.();
              return callback();
            },
          },
        }
      : {}),
  });
}

describe("accountRequest", () => {
  beforeEach(() => {
    mockedApi.mockReset();
    vi.mocked(clearAnonymous).mockReset();
    stubBrowser();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sin 401 no refresca ni redirige", async () => {
    mockedApi.mockResolvedValue({ status: "success", message: "OK", data: 1 });
    const result = await accountRequest(DATA);

    expect(result.data).toBe(1);
    expect(mockedApi).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it("ante un 401 refresca una vez y reintenta la petición", async () => {
    const backend = fakeBackend();
    const result = await accountRequest(DATA);

    expect(result.data).toEqual({ path: DATA });
    expect(backend.calls[REFRESH]).toBe(1);
    expect(backend.calls[DATA]).toBe(2);
    expect(assign).not.toHaveBeenCalled();
  });

  it("peticiones simultáneas con el token vencido comparten un solo refresco", async () => {
    const backend = fakeBackend();
    await Promise.all([accountRequest(DATA), accountRequest(`${DATA}/x`), accountRequest(`${DATA}/y`)]);

    expect(backend.calls[REFRESH]).toBe(1);
  });

  it("si el refresco falla manda a /ingresar con el regreso a la página actual y lanza el 401", async () => {
    fakeBackend({ refreshOk: false });

    await expect(accountRequest(DATA)).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledWith(`/ingresar?redirect=${encodeURIComponent("/mi-cuenta/perfil?x=1")}`);
  });

  it("con redirectOnFailure: false lanza el 401 sin navegar", async () => {
    fakeBackend({ refreshOk: false });

    await expect(accountRequest(DATA, { redirectOnFailure: false })).rejects.toMatchObject({ status: 401 });
    expect(assign).not.toHaveBeenCalled();
  });

  it("un 401 con code es respuesta de dominio: no refresca ni redirige", async () => {
    const backend = fakeBackend({ dataError: unauthorized(ErrorCode.CURRENT_PASSWORD_INCORRECT) });

    await expect(accountRequest(DATA)).rejects.toMatchObject({ status: 401, code: ErrorCode.CURRENT_PASSWORD_INCORRECT });
    expect(backend.calls[REFRESH]).toBeUndefined();
    expect(assign).not.toHaveBeenCalled();
  });

  it("si el reintento vuelve a dar 401 manda a ingresar", async () => {
    mockedApi.mockImplementation((async (path: string) => {
      if (path === REFRESH) return { status: "success", message: "OK", data: null };
      throw unauthorized();
    }) as unknown as typeof apiRequest);

    await expect(accountRequest(DATA)).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("los errores que no son 401 pasan tal cual", async () => {
    mockedApi.mockRejectedValue(new ApiRequestError(500, { status: "error", message: "boom" }));

    await expect(accountRequest(DATA)).rejects.toMatchObject({ status: 500 });
    expect(mockedApi).toHaveBeenCalledTimes(1);
  });

  it("un refresco exitoso borra la marca de anónima", async () => {
    fakeBackend();
    await accountRequest(DATA);

    expect(clearAnonymous).toHaveBeenCalled();
  });

  it("pide el refresco bajo el candado de la sesión", async () => {
    fakeBackend();
    await accountRequest(DATA);

    expect(lockRequests).toEqual(["eg-session-refresh"]);
  });

  it("si otra pestaña refrescó mientras esperaba el candado, no vuelve a refrescar y reintenta", async () => {
    stubBrowser({ beforeLockRun: () => storage.set("eg-session-refreshed-at", String(Date.now() + 1000)) });
    let refreshedByOtherTab = false;
    const calls: Record<string, number> = {};
    mockedApi.mockImplementation((async (path: string) => {
      calls[path] = (calls[path] ?? 0) + 1;
      if (path === REFRESH) throw new Error("no debía refrescar otra vez");
      if (!refreshedByOtherTab) {
        // La otra pestaña renueva la cookie justo después del primer 401.
        refreshedByOtherTab = true;
        throw unauthorized();
      }
      return { status: "success", message: "OK", data: "ok" };
    }) as unknown as typeof apiRequest);

    const result = await accountRequest(DATA);

    expect(result.data).toBe("ok");
    expect(calls[REFRESH]).toBeUndefined();
    expect(assign).not.toHaveBeenCalled();
  });

  it("sin navigator.locks refresca igual (un solo vuelo por pestaña)", async () => {
    stubBrowser({ withLocks: false });
    const backend = fakeBackend();
    await Promise.all([accountRequest(DATA), accountRequest(`${DATA}/x`)]);

    expect(backend.calls[REFRESH]).toBe(1);
  });
});
