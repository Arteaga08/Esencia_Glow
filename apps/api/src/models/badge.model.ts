import { Schema, model, type HydratedDocument, type Model } from "mongoose";
import { BadgeColor } from "@esencia-glow/shared";

/**
 * Badge de producto: texto libre + color de una paleta fija (enum, no color
 * picker libre, para no romper el sistema de diseño re-skineable). Sin
 * `slug`: no se busca por URL, solo por `_id` (Product.badgeId). Un producto
 * lleva a lo más una badge — la relación vive en `Product`, no aquí, así que
 * asignar otra simplemente reemplaza el `badgeId` sin tocar esta colección.
 */
interface BadgeAttrs {
  text: string;
  color: BadgeColor;
}

type BadgeDocument = HydratedDocument<BadgeAttrs>;
type BadgeModel = Model<BadgeAttrs>;

const badgeSchema = new Schema<BadgeAttrs, BadgeModel>(
  {
    text: { type: String, required: true, trim: true, maxlength: 40 },
    color: { type: String, enum: Object.values(BadgeColor), required: true },
  },
  { timestamps: true },
);

badgeSchema.index({ text: 1 });

const Badge = model<BadgeAttrs, BadgeModel>("Badge", badgeSchema);

export { Badge };
export type { BadgeDocument, BadgeAttrs };
