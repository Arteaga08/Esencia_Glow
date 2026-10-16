import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { closeServedApps, serveApp } from "./helpers/serve-app.js";

// Servidor en 127.0.0.1 explícito (ver `serveApp`): supertest con la app
// directa escucha en el comodín y en macOS otro proceso puede quedarse con la petición.
afterEach(closeServedApps);

describe("GET /api/v1/health", () => {
  it("responde 200 con la envoltura estándar de éxito", async () => {
    const api = await serveApp(buildApp());

    const response = await api.get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "success",
      message: "OK",
      data: { uptime: expect.any(Number) },
    });
  });
});

describe("GET /api/v1/health/ready", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("responde 200 cuando Mongo está conectado y responde al ping", async () => {
    const api = await serveApp(buildApp());

    const response = await api.get("/api/v1/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "success",
      message: "OK",
      data: { uptime: expect.any(Number) },
    });
  });

  it("responde 503 cuando readyState no es 1 (conexión caída/conectando)", async () => {
    vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0);
    const api = await serveApp(buildApp());

    const response = await api.get("/api/v1/health/ready");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("error");
  });

  it("responde 503 cuando Mongo está 'conectado' pero el ping al admin falla", async () => {
    vi.spyOn(mongoose.connection, "db", "get").mockReturnValue({
      admin: () => ({ ping: () => Promise.reject(new Error("cluster caído")) }),
    } as unknown as typeof mongoose.connection.db);
    const api = await serveApp(buildApp());

    const response = await api.get("/api/v1/health/ready");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("error");
  });
});

describe("GET /api/v1/ruta-inexistente", () => {
  it("responde 404 sin exponer detalles internos", async () => {
    const api = await serveApp(buildApp());

    const response = await api.get("/api/v1/ruta-inexistente");

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("fail");
  });
});
