"use client";

import { OverviewSalesCharts } from "@/components/overview/overview-sales-charts";
import { OverviewSnapshotCards } from "@/components/overview/overview-snapshot-cards";

/**
 * Resumen (Milestone 2.9) — cierra el Milestone 2 completo. Composición
 * pura: junta stats que cada módulo ya expone (Pedidos, Envíos, Inventario,
 * Suscripciones) más la serie de ventas nueva (`overview.service.ts`), sin
 * lógica de negocio propia. Propuesta B elegida por Manuel de tres
 * presentadas en `/overview/preview` (borrado tras la elección): "qué
 * atender primero" — las 4 tarjetas de foto arriba (lo que necesita acción
 * hoy), las 3 series de venta debajo, cada una con su propio filtro
 * día/semana/mes/año (decisión de Manuel: "deben tener sus gráficas
 * separadas, no todo junto"). Solo lectura: cada tarjeta enlaza a su
 * sección, ya filtrada cuando esa sección sabe leer el filtro de la URL.
 */
export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <OverviewSnapshotCards />
      </div>

      <div className="flex flex-col gap-6">
        <OverviewSalesCharts />
      </div>
    </div>
  );
}
