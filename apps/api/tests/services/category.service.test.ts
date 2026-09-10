import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import * as categoryService from "../../src/services/category.service.js";

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
