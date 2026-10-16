import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import request from "supertest";

const servers: Server[] = [];
const fileServers: Server[] = [];

/** Levanta la app en 127.0.0.1 explícito, en un puerto efímero, y la registra en `registry`. */
async function listenOnLoopback(app: Express, registry: Server[]): Promise<string> {
  const server = app.listen(0, "127.0.0.1");
  registry.push(server);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

/**
 * Un solo servidor por test y URL explícita. `request(app)` abre y cierra un
 * servidor por petición: con cientos de peticiones seguidas (tests de cuotas)
 * la carrera de `listen(0)` mezcla respuestas de otros procesos (400/404
 * intermitentes). Llamar a `closeServedApps()` en `afterEach`.
 */
async function serveApp(app: Express) {
  return request(await listenOnLoopback(app, servers));
}

function closeServedApps(): void {
  for (const server of servers.splice(0)) server.close();
}

/**
 * Un solo servidor por ARCHIVO de test, en 127.0.0.1; devuelve la URL base,
 * que `request(url)`/`request.agent(url)` aceptan igual que una app.
 *
 * Por qué no `request(app)`: supertest hace `app.listen(0)` sin host (escucha
 * en el comodín `::`) pero conecta a 127.0.0.1 (`supertest/lib/test.js`). En
 * macOS el kernel puede darle al comodín un puerto que otro proceso ya tiene
 * en 127.0.0.1 (Pylance de VS Code, el mongod de otro fork), y ese listener,
 * más específico, se queda con la petición: `{}`, 404 o "socket hang up" al
 * azar. Con 127.0.0.1 explícito el kernel nunca repite un puerto ocupado ahí.
 * `tests/setup.ts` los cierra en `afterAll` (`closeFileServers`).
 */
async function serveAppForFile(app: Express): Promise<string> {
  return listenOnLoopback(app, fileServers);
}

async function closeFileServers(): Promise<void> {
  await Promise.all(
    fileServers.splice(0).map(async (server) => {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }),
  );
}

export { serveApp, closeServedApps, serveAppForFile, closeFileServers };
