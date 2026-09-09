import { Router } from "express";
import healthRoutes from "./health.routes.js";

/**
 * Índice de routers de la API v1. Los módulos de dominio (auth, catálogo,
 * órdenes, etc.) se montan aquí a medida que se construyen en milestones
 * siguientes — nunca se agregan directo en app.ts.
 */
const v1Router = Router();

v1Router.use(healthRoutes);

export { v1Router };
