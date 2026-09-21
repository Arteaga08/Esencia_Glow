import { describe, expect, it } from "vitest";
import { HomeSectionKey } from "@esencia-glow/shared";
import { HomeContent } from "../../src/models/home-content.model.js";
import { readHomeContent, writeSection } from "../../src/services/home-content-store.js";
import { AppError } from "../../src/utils/app-error.js";

describe("services/home-content-store — CAS por sección", () => {
  it("la primera escritura (versión 0) crea el singleton y deja la sección en versión 1", async () => {
    expect(await HomeContent.countDocuments()).toBe(0);

    const doc = await writeSection(HomeSectionKey.ANNOUNCEMENT, 0, {
      set: { text: "Envío gratis", isActive: true },
    });

    expect(doc.announcement?.version).toBe(1);
    expect(doc.announcement?.text).toBe("Envío gratis");
    expect(doc.announcement?.updatedAt).toBeInstanceOf(Date);
    expect(await HomeContent.countDocuments()).toBe(1);
  });

  it("una escritura con la versión leída sube la versión en +1", async () => {
    await writeSection(HomeSectionKey.ANNOUNCEMENT, 0, { set: { text: "uno", isActive: true } });
    const doc = await writeSection(HomeSectionKey.ANNOUNCEMENT, 1, { set: { text: "dos" } });

    expect(doc.announcement?.version).toBe(2);
    expect(doc.announcement?.text).toBe("dos");
    // `isActive` no viajó en este write: se conserva, no se pisa.
    expect(doc.announcement?.isActive).toBe(true);
  });

  it("una versión desfasada da 409 y no modifica nada", async () => {
    await writeSection(HomeSectionKey.ANNOUNCEMENT, 0, { set: { text: "uno", isActive: true } });
    await writeSection(HomeSectionKey.ANNOUNCEMENT, 1, { set: { text: "dos" } });

    const stale = writeSection(HomeSectionKey.ANNOUNCEMENT, 1, { set: { text: "pisado" } });

    await expect(stale).rejects.toMatchObject({ statusCode: 409 });
    await expect(stale).rejects.toBeInstanceOf(AppError);
    const after = await readHomeContent();
    expect(after?.announcement?.text).toBe("dos");
    expect(after?.announcement?.version).toBe(2);
  });

  it("una versión >= 1 sobre un singleton inexistente da 409 y NO lo crea", async () => {
    await expect(
      writeSection(HomeSectionKey.ANNOUNCEMENT, 3, { set: { text: "x" } }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await HomeContent.countDocuments()).toBe(0);
  });

  it("versión 0 sobre una sección que ya existe da 409 (no recrea)", async () => {
    await writeSection(HomeSectionKey.ANNOUNCEMENT, 0, { set: { text: "uno", isActive: true } });

    await expect(
      writeSection(HomeSectionKey.ANNOUNCEMENT, 0, { set: { text: "otro" } }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("escribir una sección nunca toca otra", async () => {
    await writeSection(HomeSectionKey.ANNOUNCEMENT, 0, { set: { text: "aviso", isActive: true } });
    await writeSection(HomeSectionKey.FEATURED_PRODUCTS, 0, { set: { title: "Destacados", isActive: true } });
    await writeSection(HomeSectionKey.ANNOUNCEMENT, 1, { set: { text: "aviso 2" } });

    const doc = await readHomeContent();
    expect(doc?.announcement?.version).toBe(2);
    expect(doc?.featuredProducts?.version).toBe(1);
    expect(doc?.featuredProducts?.title).toBe("Destacados");
  });

  it("dos escrituras concurrentes con la misma versión: exactamente una gana y una recibe 409", async () => {
    await writeSection(HomeSectionKey.ANNOUNCEMENT, 0, { set: { text: "base", isActive: true } });

    const results = await Promise.allSettled([
      writeSection(HomeSectionKey.ANNOUNCEMENT, 1, { set: { text: "A" } }),
      writeSection(HomeSectionKey.ANNOUNCEMENT, 1, { set: { text: "B" } }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatchObject({ statusCode: 409 });
    expect((await readHomeContent())?.announcement?.version).toBe(2);
  });

  it("dos primeras escrituras concurrentes (versión 0) de la MISMA sección: una gana, una 409", async () => {
    const results = await Promise.allSettled([
      writeSection(HomeSectionKey.ANNOUNCEMENT, 0, { set: { text: "A", isActive: true } }),
      writeSection(HomeSectionKey.ANNOUNCEMENT, 0, { set: { text: "B", isActive: true } }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected[0]!.reason).toMatchObject({ statusCode: 409 });
    expect(await HomeContent.countDocuments()).toBe(1);
  });

  it("primeras escrituras concurrentes de secciones DISTINTAS sobre un singleton vacío: TODAS se aplican", async () => {
    // El insert del `_id` fijo compite entre las siete; la perdedora del insert
    // NO es una escritura vieja (nadie editó SU sección) y no debe recibir 409.
    // Varias rondas: la carrera es probabilística (sin el reintento de
    // `writeSection` se rechazan ~1 de cada 4 escrituras en esta prueba).
    const sections = Object.values(HomeSectionKey);

    for (let round = 0; round < 15; round += 1) {
      await HomeContent.deleteMany({});
      const results = await Promise.allSettled(
        sections.map((key) => writeSection(key, 0, { set: { isActive: true } })),
      );

      expect(results.filter((r) => r.status === "rejected")).toHaveLength(0);
      const doc = await readHomeContent();
      for (const key of sections) expect(doc?.[key]?.version).toBe(1);
      expect(await HomeContent.countDocuments()).toBe(1);
    }
  });

  it("`unset` elimina campos de la sección y sube la versión", async () => {
    await writeSection(HomeSectionKey.ANNOUNCEMENT, 0, {
      set: { text: "aviso", href: "/ofertas", isActive: true },
    });
    const doc = await writeSection(HomeSectionKey.ANNOUNCEMENT, 1, { unset: ["href"] });

    expect(doc.announcement?.href).toBeUndefined();
    expect(doc.announcement?.version).toBe(2);
  });

  it("readHomeContent devuelve null si el singleton no existe y no lo crea", async () => {
    expect(await readHomeContent()).toBeNull();
    expect(await HomeContent.countDocuments()).toBe(0);
  });
});
