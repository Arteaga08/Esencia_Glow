import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import * as categoryService from "../../src/services/category.service.js";
import { parseListQuery } from "../../src/utils/parse-list-query.js";

describe("services/category — jerarquía de dos niveles y borrado", () => {
  it("crea una categoría raíz", async () => {
    const root = await categoryService.createCategory({ name: "Skincare Coreano" });
    expect(root.parentId).toBeNull();
    expect(root.slug).toBe("skincare-coreano");
  });

  it("crea una subcategoría bajo una raíz", async () => {
    const root = await categoryService.createCategory({ name: "Skincare Coreano" });
    const child = await categoryService.createCategory({
      name: "Serums",
      parentId: root.id,
    });
    expect(child.parentId?.toString()).toBe(root.id);
  });

  it("rechaza crear una nieta (subcategoría de una subcategoría)", async () => {
    const root = await categoryService.createCategory({ name: "Skincare Coreano" });
    const child = await categoryService.createCategory({ name: "Serums", parentId: root.id });

    await expect(
      categoryService.createCategory({ name: "Serums de vitamina C", parentId: child.id }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rechaza convertir en subcategoría a una raíz que ya tiene hijas", async () => {
    const rootA = await categoryService.createCategory({ name: "Skincare Coreano" });
    const rootB = await categoryService.createCategory({ name: "Cuerpo" });
    await categoryService.createCategory({ name: "Serums", parentId: rootA.id });

    await expect(
      categoryService.updateCategory(rootA.id, { parentId: rootB.id }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rechaza que una categoría sea su propio padre", async () => {
    const root = await categoryService.createCategory({ name: "Skincare Coreano" });
    await expect(
      categoryService.updateCategory(root.id, { parentId: root.id }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rechaza borrar una categoría con productos asociados", async () => {
    const root = await categoryService.createCategory({ name: "Skincare Coreano" });
    await Product.create({
      name: "Serum de Vitamina C",
      slug: "serum-de-vitamina-c",
      description: "Descripción",
      categoryId: new Types.ObjectId(root.id),
      variants: [],
    });

    await expect(categoryService.deleteCategory(root.id)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("rechaza un slug duplicado (nombre repetido)", async () => {
    await categoryService.createCategory({ name: "Skincare Coreano" });
    await expect(categoryService.createCategory({ name: "Skincare Coreano" })).rejects.toThrow();
  });

  it("borra sin problema una categoría sin hijas ni productos", async () => {
    const root = await categoryService.createCategory({ name: "Skincare Coreano" });
    await categoryService.deleteCategory(root.id);
    expect(await Category.findById(root.id)).toBeNull();
  });
});

describe("services/category — reorderCategories", () => {
  it("reordena las categorías raíz según el orden del arreglo", async () => {
    const a = await categoryService.createCategory({ name: "Skincare Coreano" });
    const b = await categoryService.createCategory({ name: "Cuerpo" });
    const c = await categoryService.createCategory({ name: "Maquillaje" });

    await categoryService.reorderCategories(null, [c.id, a.id, b.id]);

    const [reorderedC, reorderedA, reorderedB] = await Promise.all([
      Category.findById(c.id),
      Category.findById(a.id),
      Category.findById(b.id),
    ]);
    expect(reorderedC?.sortOrder).toBe(0);
    expect(reorderedA?.sortOrder).toBe(1);
    expect(reorderedB?.sortOrder).toBe(2);
  });

  it("reordena las subcategorías de un padre sin tocar las de otro", async () => {
    const rootA = await categoryService.createCategory({ name: "Skincare Coreano" });
    const rootB = await categoryService.createCategory({ name: "Cuerpo" });
    const serums = await categoryService.createCategory({ name: "Serums", parentId: rootA.id });
    const tonicos = await categoryService.createCategory({ name: "Tónicos", parentId: rootA.id });
    const jabones = await categoryService.createCategory({ name: "Jabones", parentId: rootB.id });

    await categoryService.reorderCategories(rootA.id, [tonicos.id, serums.id]);

    const [reorderedTonicos, reorderedSerums, reorderedJabones] = await Promise.all([
      Category.findById(tonicos.id),
      Category.findById(serums.id),
      Category.findById(jabones.id),
    ]);
    expect(reorderedTonicos?.sortOrder).toBe(0);
    expect(reorderedSerums?.sortOrder).toBe(1);
    expect(reorderedJabones?.sortOrder).toBe(0); // no la tocó el reorder de rootA
  });

  it("rechaza un arreglo que no coincide con los hermanos actuales (falta uno)", async () => {
    const a = await categoryService.createCategory({ name: "Skincare Coreano" });
    await categoryService.createCategory({ name: "Cuerpo" });

    await expect(categoryService.reorderCategories(null, [a.id])).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rechaza un arreglo con un id repetido", async () => {
    const a = await categoryService.createCategory({ name: "Skincare Coreano" });
    const b = await categoryService.createCategory({ name: "Cuerpo" });

    await expect(categoryService.reorderCategories(null, [a.id, a.id])).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(b).toBeDefined();
  });

  it("rechaza un id que no es hermano bajo ese padre", async () => {
    const root = await categoryService.createCategory({ name: "Skincare Coreano" });
    const child = await categoryService.createCategory({ name: "Serums", parentId: root.id });

    // child no es raíz: reordenar la raíz con su id no debe colarse.
    await expect(categoryService.reorderCategories(null, [child.id])).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("services/category — conteos en el listado", () => {
  it("incluye childrenCount en una raíz y productCount en una subcategoría", async () => {
    const root = await categoryService.createCategory({ name: "Skincare Coreano" });
    const child = await categoryService.createCategory({ name: "Serums", parentId: root.id });
    await categoryService.createCategory({ name: "Tónicos", parentId: root.id });
    await Product.create({
      name: "Serum de Vitamina C",
      slug: "serum-de-vitamina-c",
      description: "Descripción",
      categoryId: new Types.ObjectId(child.id),
      variants: [],
    });

    const { categories: roots } = await categoryService.listCategories({
      ...parseListQuery({}, "sortOrder"),
      parentId: null,
    });
    expect(roots.find((c) => c.id === root.id)?.childrenCount).toBe(2);

    const { categories: children } = await categoryService.listCategories({
      ...parseListQuery({}, "sortOrder"),
      parentId: root.id,
    });
    expect(children.find((c) => c.id === child.id)?.productCount).toBe(1);
  });

  it("getCategoryById también trae los conteos", async () => {
    const root = await categoryService.createCategory({ name: "Skincare Coreano" });
    await categoryService.createCategory({ name: "Serums", parentId: root.id });

    const fetched = await categoryService.getCategoryById(root.id);
    expect(fetched.childrenCount).toBe(1);
    expect(fetched.productCount).toBe(0);
  });
});
