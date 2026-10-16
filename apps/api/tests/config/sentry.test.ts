import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => {
  const scope = { setContext: vi.fn() };
  return {
    scope,
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    withScope: vi.fn((callback: (s: typeof scope) => void) => callback(scope)),
    init: vi.fn(),
    flush: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("@sentry/node", () => sentry);

const { logger } = await import("../../src/config/logger.js");
const { scrubBreadcrumb, scrubEvent } = await import("../../src/config/sentry.js");

describe("logger -> Sentry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envía a Sentry el Error de un logger.error con solo los ids como contexto", () => {
    const err = new Error("Stripe no respondió");

    logger.error(
      { err, orderId: "ord_1", email: "clienta@example.com", phone: "5512345678" },
      "Fallo al reconciliar un pago pendiente",
    );

    expect(sentry.captureException).toHaveBeenCalledExactlyOnceWith(err);
    expect(sentry.scope.setContext).toHaveBeenCalledWith("log", {
      message: "Fallo al reconciliar un pago pendiente",
      orderId: "ord_1",
    });
  });

  it("envía un mensaje cuando el log de error no trae un Error", () => {
    logger.error({ err: "razón de texto" }, "Unhandled promise rejection");

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.captureMessage).toHaveBeenCalledWith("Unhandled promise rejection", "error");
  });

  it("no envía logs de nivel info ni warn", () => {
    logger.info({ orderId: "ord_1" }, "Barrido de reservas vencidas");
    logger.warn({ err: new Error("entrada inválida") }, "Error no operacional");

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("no rompe el log si Sentry lanza", () => {
    sentry.withScope.mockImplementationOnce(() => {
      throw new Error("sentry caído");
    });

    expect(() => logger.error({ err: new Error("x") }, "falló")).not.toThrow();
  });
});

describe("scrubEvent", () => {
  it("quita cookies, cabeceras, cuerpo, query y usuario del evento", () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        url: "https://api.esenciaglow.com.mx/api/v1/orders",
        cookies: { access_token: "secreto" },
        headers: { authorization: "Bearer secreto" },
        data: { cardNumber: "4242" },
        query_string: "token=secreto",
      },
      user: { id: "u1", email: "clienta@example.com" },
    });

    expect(event.request).toEqual({ url: "https://api.esenciaglow.com.mx/api/v1/orders" });
    expect(event.user).toBeUndefined();
  });

  it("quita la query y el fragmento de request.url", () => {
    const event = scrubEvent({
      type: undefined,
      request: { url: "https://api.esenciaglow.com.mx/api/v1/admin/customers?search=clienta%40example.com#x" },
    });

    expect(event.request?.url).toBe("https://api.esenciaglow.com.mx/api/v1/admin/customers");
  });

  it("descarta los breadcrumbs de http y consola y quita la query de los demás", () => {
    const event = scrubEvent({
      type: undefined,
      breadcrumbs: [
        { category: "http", data: { url: "https://api.pwnedpasswords.com/range/5BAA6" } },
        { type: "http", category: "undici", data: { url: "https://api.resend.com/emails" } },
        { category: "console", message: "clienta@example.com" },
        { category: "navigation", data: { url: "/api/v1/admin/customers?search=clienta%40example.com" } },
      ],
    });

    expect(event.breadcrumbs).toEqual([{ category: "navigation", data: { url: "/api/v1/admin/customers" } }]);
  });
});

describe("scrubBreadcrumb", () => {
  it("devuelve null para http/fetch/console y deja pasar el resto", () => {
    expect(scrubBreadcrumb({ category: "fetch", data: { url: "https://x.test/?a=1" } })).toBeNull();
    expect(scrubBreadcrumb({ category: "console", message: "x" })).toBeNull();
    expect(scrubBreadcrumb({ category: "mongo", message: "find" })).toEqual({ category: "mongo", message: "find" });
  });
});
