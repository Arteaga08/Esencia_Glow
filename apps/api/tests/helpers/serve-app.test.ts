import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { closeFileServers, serveAppForFile } from "./serve-app.js";

/**
 * Regresión de los flakes de la suite: `request(app)` de supertest escucha en
 * el comodín (`::`) pero conecta a 127.0.0.1, y en macOS otro proceso que
 * tenga ese puerto en 127.0.0.1 (Pylance, el mongod de otro fork) se queda con
 * la petición. El servidor por archivo debe escuchar en 127.0.0.1 explícito.
 */
describe("helpers/serve-app — servidor por archivo", () => {
  function buildEchoApp() {
    const app = express();
    app.get("/ping", (_req, res) => {
      res.json({ pong: true });
    });
    return app;
  }

  it("escucha en 127.0.0.1 (no en el comodín) y la URL apunta ahí", async () => {
    const baseUrl = await serveAppForFile(buildEchoApp());

    expect(baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const response = await request(baseUrl).get("/ping");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ pong: true });
    // En el comodín, ::1 también contestaría; en 127.0.0.1 explícito, no.
    const port = new URL(baseUrl).port;
    await expect(request(`http://[::1]:${port}`).get("/ping")).rejects.toThrow(/ECONNREFUSED/);

    await closeFileServers();
  });

  it("closeFileServers cierra el servidor: después ya no acepta conexiones", async () => {
    const baseUrl = await serveAppForFile(buildEchoApp());
    await closeFileServers();

    await expect(request(baseUrl).get("/ping")).rejects.toThrow(/ECONNREFUSED/);
  });
});
