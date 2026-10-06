import type request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createCustomerSession } from "../helpers/admin-session.js";

const app = buildApp();

function address(label: string, overrides: Record<string, unknown> = {}) {
  return {
    label,
    fullName: "María López",
    phone: "3312345678",
    street: "Av. Vallarta",
    exteriorNumber: "1234",
    neighborhood: "Americana",
    city: "Guadalajara",
    state: "Jalisco",
    postalCode: "44160",
    ...overrides,
  };
}

async function addAddress(agent: ReturnType<typeof request.agent>, label: string, overrides = {}) {
  return agent.post("/api/v1/account/addresses").send(address(label, overrides));
}

async function list(agent: ReturnType<typeof request.agent>) {
  const res = await agent.get("/api/v1/account");
  return res.body.data.addresses as Array<{ id: string; label: string; isDefault: boolean }>;
}

describe("routes/account/addresses — libreta de direcciones", () => {
  it("la primera dirección queda principal y la segunda no", async () => {
    const { agent } = await createCustomerSession(app);
    const first = await addAddress(agent, "Casa");
    const second = await addAddress(agent, "Oficina");

    expect(first.status).toBe(201);
    expect(first.body.data.isDefault).toBe(true);
    expect(second.body.data.isDefault).toBe(false);
  });

  it("el alta con isDefault true deja la nueva como única principal", async () => {
    const { agent } = await createCustomerSession(app);
    await addAddress(agent, "Casa");
    const created = await addAddress(agent, "Oficina", { isDefault: true });

    expect(created.status).toBe(201);
    expect(created.body.data.isDefault).toBe(true);
    const all = await list(agent);
    expect(all.filter((a) => a.isDefault).map((a) => a.label)).toEqual(["Oficina"]);
  });

  it("el alta con isDefault false no le quita la principal a la existente", async () => {
    const { agent } = await createCustomerSession(app);
    await addAddress(agent, "Casa");
    await addAddress(agent, "Oficina", { isDefault: false });

    expect((await list(agent)).filter((a) => a.isDefault).map((a) => a.label)).toEqual(["Casa"]);
  });

  it("400 con un isDefault que no es booleano", async () => {
    const { agent } = await createCustomerSession(app);
    expect((await addAddress(agent, "Casa", { isDefault: "yes" })).status).toBe(400);
  });

  it("dos altas simultáneas con isDefault dejan una sola principal", async () => {
    const { agent } = await createCustomerSession(app);
    await addAddress(agent, "Casa");
    const results = await Promise.all([addAddress(agent, "A", { isDefault: true }), addAddress(agent, "B", { isDefault: true })]);

    expect(results.map((r) => r.status)).toEqual([201, 201]);
    const all = await list(agent);
    expect(all).toHaveLength(3);
    expect(all.filter((a) => a.isDefault)).toHaveLength(1);
  });

  it("el alta con isDefault respeta el tope de 5", async () => {
    const { agent } = await createCustomerSession(app);
    for (let i = 1; i <= 5; i += 1) await addAddress(agent, `Dir ${i}`);

    expect((await addAddress(agent, "Dir 6", { isDefault: true })).status).toBe(409);
    const all = await list(agent);
    expect(all).toHaveLength(5);
    expect(all.find((a) => a.isDefault)?.label).toBe("Dir 1");
  });

  it("guarda literales los valores que empiezan con $", async () => {
    const { agent } = await createCustomerSession(app);
    await addAddress(agent, "Casa");
    const res = await addAddress(agent, "Oficina", { isDefault: true, street: "$street", references: "$$ROOT", neighborhood: "$addresses" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ street: "$street", references: "$$ROOT", neighborhood: "$addresses", isDefault: true });
  });

  it("borrar y fijar principal a la vez nunca deja dos principales", async () => {
    const { agent } = await createCustomerSession(app);
    const home = await addAddress(agent, "Casa");
    const office = await addAddress(agent, "Oficina");
    await addAddress(agent, "Bodega");

    await Promise.all([
      agent.delete(`/api/v1/account/addresses/${home.body.data.id}`),
      agent.post(`/api/v1/account/addresses/${office.body.data.id}/default`),
    ]);

    const all = await list(agent);
    expect(all).toHaveLength(2);
    expect(all.filter((a) => a.isDefault)).toHaveLength(1);
  });

  it("topa en 5 con 409", async () => {
    const { agent } = await createCustomerSession(app);
    for (let i = 1; i <= 5; i += 1) expect((await addAddress(agent, `Dir ${i}`)).status).toBe(201);

    const sixth = await addAddress(agent, "Dir 6");
    expect(sixth.status).toBe(409);
    expect(await list(agent)).toHaveLength(5);
  });

  it("dos altas simultáneas no pasan del tope", async () => {
    const { agent } = await createCustomerSession(app);
    for (let i = 1; i <= 4; i += 1) await addAddress(agent, `Dir ${i}`);

    const results = await Promise.all([addAddress(agent, "A"), addAddress(agent, "B"), addAddress(agent, "C")]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await list(agent)).toHaveLength(5);
  });

  it("PATCH edita campos de la dirección", async () => {
    const { agent } = await createCustomerSession(app);
    const created = await addAddress(agent, "Casa");
    const res = await agent.patch(`/api/v1/account/addresses/${created.body.data.id}`).send({ street: "Calle Hidalgo", references: "Portón negro" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ street: "Calle Hidalgo", references: "Portón negro", label: "Casa", isDefault: true });
  });

  it("POST /:id/default cambia la principal y limpia la anterior", async () => {
    const { agent } = await createCustomerSession(app);
    await addAddress(agent, "Casa");
    const second = await addAddress(agent, "Oficina");

    const res = await agent.post(`/api/v1/account/addresses/${second.body.data.id}/default`);
    expect(res.status).toBe(200);

    const all = await list(agent);
    expect(all.filter((a) => a.isDefault).map((a) => a.label)).toEqual(["Oficina"]);
  });

  it("borrar la principal promueve otra; borrar la última deja la libreta vacía", async () => {
    const { agent } = await createCustomerSession(app);
    const home = await addAddress(agent, "Casa");
    await addAddress(agent, "Oficina");

    expect((await agent.delete(`/api/v1/account/addresses/${home.body.data.id}`)).status).toBe(200);
    const left = await list(agent);
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ label: "Oficina", isDefault: true });

    await agent.delete(`/api/v1/account/addresses/${left[0]!.id}`);
    expect(await list(agent)).toHaveLength(0);
  });

  it("404 (nunca 403) con la dirección de otra clienta, en las tres rutas con id", async () => {
    const owner = await createCustomerSession(app);
    const intruder = await createCustomerSession(app);
    const created = await addAddress(owner.agent, "Casa");
    const id = created.body.data.id as string;

    expect((await intruder.agent.patch(`/api/v1/account/addresses/${id}`).send({ street: "X" })).status).toBe(404);
    expect((await intruder.agent.post(`/api/v1/account/addresses/${id}/default`)).status).toBe(404);
    expect((await intruder.agent.delete(`/api/v1/account/addresses/${id}`)).status).toBe(404);
    expect(await list(owner.agent)).toHaveLength(1);
  });

  it("404 con un id inexistente y 400 con un id mal formado", async () => {
    const { agent } = await createCustomerSession(app);
    expect((await agent.delete("/api/v1/account/addresses/64b000000000000000000000")).status).toBe(404);
    expect((await agent.delete("/api/v1/account/addresses/nope")).status).toBe(400);
  });

  it("400 con estado fuera de catálogo, CP inválido, etiqueta vacía y HTML", async () => {
    const { agent } = await createCustomerSession(app);
    const res = await addAddress(agent, "", { state: "Narnia", postalCode: "123", street: "<script>x</script>" });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(["label", "state", "postalCode", "street"]));
  });
});
