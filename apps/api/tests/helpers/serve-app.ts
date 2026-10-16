import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import request from "supertest";

const servers: Server[] = [];

/**
 * Un solo servidor por test y URL explícita. `request(app)` abre y cierra un
 * servidor por petición: con cientos de peticiones seguidas (tests de cuotas)
 * la carrera de `listen(0)` mezcla respuestas de otros procesos (400/404
 * intermitentes). Llamar a `closeServedApps()` en `afterEach`.
 */
async function serveApp(app: Express) {
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return request(`http://127.0.0.1:${port}`);
}

function closeServedApps(): void {
  for (const server of servers.splice(0)) server.close();
}

export { serveApp, closeServedApps };
