import Joi from "joi";
import { BadgeColor } from "@esencia-glow/shared";

const createBadgeSchema = Joi.object({
  text: Joi.string().trim().min(1).max(40).required(),
  color: Joi.string()
    .valid(...Object.values(BadgeColor))
    .required(),
});

const updateBadgeSchema = Joi.object({
  text: Joi.string().trim().min(1).max(40),
  color: Joi.string().valid(...Object.values(BadgeColor)),
}).min(1);

export { createBadgeSchema, updateBadgeSchema };
