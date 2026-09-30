import type { Request } from "express";

/**
 * En Express 5 `req.query` es un getter del prototipo que vuelve a parsear
 * `req.url` en cada acceso: mutar el objeto que devuelve no persiste ni
 * siquiera hasta el siguiente middleware. Definir `query` como propiedad
 * propia de la request sombrea ese getter, así que todo acceso posterior
 * (controllers incluidos) recibe `value` tal cual.
 */
function replaceRequestQuery(req: Request, value: Request["query"]): void {
  Object.defineProperty(req, "query", {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

export { replaceRequestQuery };
