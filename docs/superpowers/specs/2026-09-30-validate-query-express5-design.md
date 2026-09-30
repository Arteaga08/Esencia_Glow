# Query validada que sí llega al controller (Express 5)

Fecha: 2026-09-30 · Rama: `fix/validate-query-express5`

## Problema

En Express 5, `req.query` es un getter del prototipo que vuelve a parsear `req.url` en cada acceso.
`validate.ts` copiaba el valor convertido por Joi con `delete` + `Object.assign` sobre el objeto que
devolvía el getter; esa copia se pierde en el siguiente acceso. Consecuencias:

- Booleanos comparados con `===` se ignoran: `incident` en envíos de suscripción
  (`subscription-shipment-panel.service.ts`) y `attention` en cuentas de suscripción
  (`subscription-account-admin.service.ts`) devuelven TODO sin filtrar.
- `isActive` (categorías, planes) e `incident` (órdenes) solo funcionan porque Mongoose castea
  `"false"` → `false`.
- Se pierden `trim()`/`lowercase()` (`category` del catálogo público, `search`) y cualquier `.default()`.
- `mongoSanitize` sanea una copia de `req.query` que también se descarta: hoy no sanea la query.

## Decisión (Propuesta A, aprobada)

Redefinir `query` como propiedad propia de la request con `Object.defineProperty`. La propiedad
propia sombrea el getter del prototipo, así que todo acceso posterior devuelve el valor fijado.
Probado contra Express 5.2.1.

- `src/utils/replace-request-query.ts` — `replaceRequestQuery(req, value)`; único lugar con la
  explicación de Express 5.
- `validate.ts` — rama `query` usa el helper; `body`/`params` sin cambios.
- `mongo-sanitize.ts` — lee `req.query` una vez, sanea esa copia y la fija con el helper.
- Controllers: sin cambios.
- Comentarios que afirman el comportamiento viejo como hecho se corrigen
  (`validate.ts`, `mongo-sanitize.ts`, `home-image.controller.ts`, `customer-admin.validator.ts`);
  el código detrás de ellos (`Number()`, defaults en el controller) no se toca.

Descartadas: `req.validatedQuery` (migrar ~17 controllers, `req.query` crudo sigue accesible) y
parches por consumidor.

## Pruebas (TDD)

- Integración (supertest, query real): `?incident=true|false` en envíos de suscripción, con una caja
  sin incidencia y luego con incidencia; `?attention=true` en cuentas ahora debe EXCLUIR una cuenta
  `active` sin cambio pendiente (el test existente solo usaba `toContain` y pasaba con el bug).
- Unitario de `validate` sobre una mini app Express: `"false"` → `false`, `.default()` y `trim()`
  llegan al handler.
- Unitario de `mongoSanitize`: `?$where=x&ok=1` llega sin `$where`.

## Verificación

`pnpm --filter @esencia-glow/api typecheck && lint && test` + repro manual contra el server real.
