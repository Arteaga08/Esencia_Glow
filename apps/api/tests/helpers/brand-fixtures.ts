import type request from "supertest";

type Agent = ReturnType<typeof request.agent>;

/** Busca la marca por nombre en el CRUD admin y la crea si no existe; devuelve su id. */
async function ensureBrand(agent: Agent, name: string): Promise<string> {
  const found = await agent.get("/api/v1/admin/brands").query({ search: name, limit: 100 });
  const match = (found.body.data as { id: string; name: string }[]).find((brand) => brand.name === name);
  if (match) return match.id;
  const created = await agent.post("/api/v1/admin/brands").send({ name });
  return created.body.data.id as string;
}

export { ensureBrand };
