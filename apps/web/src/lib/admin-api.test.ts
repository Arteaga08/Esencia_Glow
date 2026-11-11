import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "./api";

vi.mock("./config", () => ({ API_URL: "http://api.test" }));
vi.mock("./api", async (importOriginal) => ({ ...(await importOriginal<typeof ApiModule>()), apiRequest: vi.fn() }));
vi.mock("./storefront/session-hint", () => ({ clearAnonymous: vi.fn() }));

import { ApiRequestError, apiRequest as baseApiRequest } from "./api";
import { apiRequest } from "./admin-api";

const REFRESH = "/api/v1/auth/refresh";
const DATA = "/api/v1/admin/products";

const mockedBase = vi.mocked(baseApiRequest);

function unauthorized() {
  return new ApiRequestError(401, { status: "fail", message: "No autenticado" });
}

let assign: ReturnType<typeof vi.fn>;

/** Simula el API: los datos dan 401 hasta que se refresca; el refresco responde `refreshOk`. */
function fakeBackend({ refreshOk = true }: { refreshOk?: boolean } = {}) {
  const calls: Record<string, number> = {};
  let refreshed = false;
  mockedBase.mockImplementation((async (path: string) => {
    calls[path] = (calls[path] ?? 0) + 1;
    if (path === REFRESH) {
      if (!refreshOk) throw unauthorized();
      refreshed = true;
      return { status: "success", message: "OK", data: null };
    }
    if (!refreshed) throw unauthorized();
    return { status: "success", message: "OK", data: { path } };
  }) as unknown as typeof baseApiRequest);
  return calls;
}

describe("apiRequest del panel", () => {
  beforeEach(() => {
    mockedBase.mockReset();
    assign = vi.fn();
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      location: { pathname: "/admin/products", search: "?page=2", assign },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
      },
    });
    vi.stubGlobal("navigator", {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("con el access token vencido refresca una vez y reintenta, sin sacar a la operadora", async () => {
    const calls = fakeBackend();

    const result = await apiRequest(DATA, { authenticated: true });

    expect(result.data).toEqual({ path: DATA });
    expect(calls[REFRESH]).toBe(1);
    expect(calls[DATA]).toBe(2);
    expect(assign).not.toHaveBeenCalled();
  });

  it("varias consultas a la vez con el token vencido comparten un solo refresco", async () => {
    const calls = fakeBackend();

    await Promise.all([
      apiRequest(DATA, { authenticated: true }),
      apiRequest(`${DATA}/1`, { authenticated: true }),
      apiRequest("/api/v1/admin/orders", { authenticated: true }),
    ]);

    expect(calls[REFRESH]).toBe(1);
  });

  it("si la sesión de verdad se acabó manda al login del panel con el regreso a la página", async () => {
    fakeBackend({ refreshOk: false });

    await expect(apiRequest(DATA, { authenticated: true })).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledWith(`/admin/login?redirect=${encodeURIComponent("/admin/products?page=2")}`);
  });

  it("las rutas /auth/* nunca refrescan: un 401 ahí no es una sesión vencida", async () => {
    mockedBase.mockRejectedValue(unauthorized());

    await expect(apiRequest("/api/v1/auth/login", { authenticated: true, method: "POST" })).rejects.toMatchObject({ status: 401 });
    expect(mockedBase).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it("las llamadas sin authenticated pasan tal cual, sin refrescar", async () => {
    mockedBase.mockRejectedValue(unauthorized());

    await expect(apiRequest("/api/v1/public/thing")).rejects.toMatchObject({ status: 401 });
    expect(mockedBase).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });
});
