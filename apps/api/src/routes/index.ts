import { Router } from "express";
import healthRoutes from "./health.routes.js";
import { authRoutes } from "./auth.routes.js";
import { adminCategoryRoutes } from "./admin-category.routes.js";
import { adminProductRoutes } from "./admin-product.routes.js";
import { productRoutes } from "./product.routes.js";
import { categoryRoutes } from "./category.routes.js";

/**
 * Índice de routers de la API v1. Los módulos de dominio (auth, catálogo,
 * órdenes, etc.) se montan aquí a medida que se construyen en milestones
 * siguientes — nunca se agregan directo en app.ts.
 */
const v1Router = Router();

v1Router.use(healthRoutes);
v1Router.use("/auth", authRoutes);
v1Router.use("/admin/categories", adminCategoryRoutes);
v1Router.use("/admin/products", adminProductRoutes);
v1Router.use("/products", productRoutes);
v1Router.use("/categories", categoryRoutes);

export { v1Router };
