import request from "supertest";
import { describe, expect, it } from "vitest";
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

describe("GET /api/v1/ruta-inexistente", () => {
  it("responde 404 sin exponer detalles internos", async () => {
    const app = buildApp();

    const response = await request(app).get("/api/v1/ruta-inexistente");

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("fail");
  });
});
