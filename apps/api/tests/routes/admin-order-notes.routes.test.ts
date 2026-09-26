import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { User } from "../../src/models/user.model.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";
import { seedPendingOrder } from "../helpers/paid-order-fixtures.js";

const app = buildApp();

/**
 * `GET /:id/notes` (Milestone 2.3b): a diferencia de `internalNotesCount`
 * en `AdminOrder`, esta ruta sí expone el cuerpo de las notas — con el
 * autor resuelto, porque el subdocumento (`_id: false`) solo guarda
 * `{body, authorId, at}`.
 */
describe("routes/admin-order — GET /:id/notes", () => {
  it("devuelve las notas en orden descendente con el autor resuelto", async () => {
    const { orderId } = await seedPendingOrder();
    const { agent } = await createAdminSession(app);

    await agent.post(`/api/v1/admin/orders/${orderId}/notes`).send({ body: "Primera nota" });
    await agent.post(`/api/v1/admin/orders/${orderId}/notes`).send({ body: "Segunda nota" });

    const res = await agent.get(`/api/v1/admin/orders/${orderId}/notes`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].body).toBe("Segunda nota");
    expect(res.body.data[1].body).toBe("Primera nota");
    expect(res.body.data[0].author).toMatchObject({ firstName: "Admin", lastName: "Glow" });
    expect(res.body.data[0].author.id).toEqual(expect.any(String));
    expect(res.body.data[0].id).toBeUndefined();
  });

  it("un pedido sin notas responde 200 con arreglo vacío", async () => {
    const { orderId } = await seedPendingOrder();
    const { agent } = await createAdminSession(app);

    const res = await agent.get(`/api/v1/admin/orders/${orderId}/notes`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("404 con un id válido que no existe, 400 con un id malformado", async () => {
    const { agent } = await createAdminSession(app);

    const notFound = await agent.get("/api/v1/admin/orders/aaaaaaaaaaaaaaaaaaaaaaaa/notes");
    expect(notFound.status).toBe(404);
    expect(notFound.body.message).toBe("Pedido no encontrado.");

    const malformed = await agent.get("/api/v1/admin/orders/no-es-un-id/notes");
    expect(malformed.status).toBe(400);
  });

  it("401 sin sesión, 403 con sesión de cliente", async () => {
    const { orderId } = await seedPendingOrder();

    const noSessionRes = await request(app).get(`/api/v1/admin/orders/${orderId}/notes`);
    expect(noSessionRes.status).toBe(401);

    const { agent: customerAgent } = await createCustomerSession(app);
    const customerRes = await customerAgent.get(`/api/v1/admin/orders/${orderId}/notes`);
    expect(customerRes.status).toBe(403);
  });

  it("una nota cuyo autor fue borrado resuelve author: null", async () => {
    const { orderId } = await seedPendingOrder();
    // Dos admins: el que escribe la nota se borra después, pero quien
    // consulta debe seguir teniendo sesión válida — borrar al propio admin
    // de la sesión que consulta invalidaría esa sesión (`protect` la
    // rechazaría con 401, no es lo que este test quiere probar).
    const { agent: authorAgent, adminId: authorId } = await createAdminSession(app);
    const { agent: readerAgent } = await createAdminSession(app);

    await authorAgent.post(`/api/v1/admin/orders/${orderId}/notes`).send({ body: "Nota de un admin que se va" });
    await User.deleteOne({ _id: authorId });

    const res = await readerAgent.get(`/api/v1/admin/orders/${orderId}/notes`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].author).toBeNull();
  });
});
