import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { BadgeColor } from "@esencia-glow/shared";
import { Badge } from "../../src/models/badge.model.js";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import * as badgeService from "../../src/services/badge.service.js";

describe("services/badge — CRUD y borrado bloqueado por referencia", () => {
  it("crea una badge", async () => {
    const badge = await badgeService.createBadge({ text: "Nuevo", color: BadgeColor.SUCCESS });
    expect(badge.text).toBe("Nuevo");
    expect(badge.color).toBe(BadgeColor.SUCCESS);
  });

  it("permite dos badges con el mismo texto (no es único)", async () => {
    await badgeService.createBadge({ text: "Nuevo", color: BadgeColor.SUCCESS });
    await expect(
      badgeService.createBadge({ text: "Nuevo", color: BadgeColor.PRIMARY }),
    ).resolves.toBeDefined();
  });

  it("actualiza texto y color", async () => {
    const badge = await badgeService.createBadge({ text: "Nuevo", color: BadgeColor.SUCCESS });
    const updated = await badgeService.updateBadge(badge.id, {
      text: "Más vendido",
      color: BadgeColor.WARNING,
    });
    expect(updated.text).toBe("Más vendido");
    expect(updated.color).toBe(BadgeColor.WARNING);
  });

  it("rechaza borrar una badge asignada a un producto", async () => {
    const badge = await badgeService.createBadge({ text: "Nuevo", color: BadgeColor.SUCCESS });
    const category = await Category.create({ name: "Skincare", slug: "skincare", parentId: null });
    await Product.create({
      name: "Serum",
      slug: "serum",
      description: "Descripción",
      categoryId: category._id,
      badgeId: new Types.ObjectId(badge.id),
      variants: [],
    });

    await expect(badgeService.deleteBadge(badge.id)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("borra sin problema una badge sin productos asociados", async () => {
    const badge = await badgeService.createBadge({ text: "Nuevo", color: BadgeColor.SUCCESS });
    await badgeService.deleteBadge(badge.id);
    expect(await Badge.findById(badge.id)).toBeNull();
  });
});
