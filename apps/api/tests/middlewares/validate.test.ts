import express from "express";
import Joi from "joi";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { mongoSanitize } from "../../src/middlewares/mongo-sanitize.js";
import { validate } from "../../src/middlewares/validate.js";

/**
 * Express 5 vuelve a parsear `req.query` en cada acceso, así que estas
 * pruebas montan una app real y leen la query desde el handler: lo que se
 * verifica es lo que un controller vería, no el resultado de `schema.validate`.
 */

const schema = Joi.object({
  incident: Joi.boolean(),
  category: Joi.string().trim().lowercase(),
  page: Joi.number().integer().default(1),
});

function buildTestApp() {
  const app = express();
  app.get("/probe", mongoSanitize, validate(schema, "query"), (req, res) => {
    res.json({ query: req.query, incidentType: typeof req.query.incident });
  });
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ error: true });
  });
  return app;
}

describe("middlewares/validate — source query en Express 5", () => {
  it('entrega "false" como boolean false al handler', async () => {
    const response = await request(buildTestApp()).get("/probe?incident=false");
    expect(response.body.incidentType).toBe("boolean");
    expect(response.body.query.incident).toBe(false);
  });

  it("aplica trim, lowercase y defaults de Joi", async () => {
    const response = await request(buildTestApp()).get("/probe?category=%20Rostro%20");
    expect(response.body.query.category).toBe("rostro");
    expect(response.body.query.page).toBe(1);
  });

  it("mongoSanitize quita las claves con $ antes de que lleguen al handler", async () => {
    const app = express();
    app.get("/probe", mongoSanitize, (req, res) => {
      res.json({ query: req.query });
    });
    const response = await request(app).get("/probe?%24where=x&ok=1");
    expect(response.body.query).toEqual({ ok: "1" });
  });
});
