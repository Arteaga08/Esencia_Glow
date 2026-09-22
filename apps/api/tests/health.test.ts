import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /api/v1/health", () => {
  it("responde 200 con la envoltura estándar de éxito", async () => {
    const app = buildApp();

    const response = await request(app).get("/api/v1/health");

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
    const app = buildApp();

    const response = await request(app).get("/api/v1/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "success",
      message: "OK",
      data: { uptime: expect.any(Number) },
    });
  });

  it("responde 503 cuando readyState no es 1 (conexión caída/conectando)", async () => {
    vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0);
    const app = buildApp();

    const response = await request(app).get("/api/v1/health/ready");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("error");
  });

  it("responde 503 cuando Mongo está 'conectado' pero el ping al admin falla", async () => {
    vi.spyOn(mongoose.connection, "db", "get").mockReturnValue({
      admin: () => ({ ping: () => Promise.reject(new Error("cluster caído")) }),
    } as unknown as typeof mongoose.connection.db);
    const app = buildApp();

    const response = await request(app).get("/api/v1/health/ready");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("error");
  });
});

describe("GET /api/v1/ruta-inexistente", () => {
  it("responde 404 sin exponer detalles internos", async () => {
    const app = buildApp();

    const response = await request(app).get("/api/v1/ruta-inexistente");

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("fail");
  });
});
