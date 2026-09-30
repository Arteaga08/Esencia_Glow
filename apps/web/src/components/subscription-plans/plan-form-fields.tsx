import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AdminSubscriptionPlan } from "@/lib/types/admin-subscription";
import { PlanHighlightsEditor } from "./plan-highlights-editor";
import { PlanPriceFields } from "./plan-price-fields";
import type { PlanFormValue } from "./plan-form-value";

interface PlanFormFieldsProps {
  value: PlanFormValue;
  onChange: (patch: Partial<PlanFormValue>) => void;
  errors: Record<string, string>;
  /** Plan guardado cuando se edita; `null` al crear. Decide si los precios
   * son editables y da el dato de lugares ocupados para el cupo. */
  plan: AdminSubscriptionPlan | null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <p className="mb-6 text-section-title text-foreground">{title}</p>
      {children}
    </Card>
  );
}

/**
 * Campos del plan en bloques, mismo ritmo que la creación de producto
 * (feedback de Manuel en 2.7b-2): datos, cobro y cupo. Un plan es UNA
 * suscripción con su precio mensual y, opcionalmente, el anual dentro de
 * ella (decisión de 2.7b-1: nunca dos planes separados). Sin botones: el
 * editor decide cómo se envía. Los nombres de `errors` son los del backend
 * (`fieldErrors` de Joi), así el error queda pegado a su campo.
 */
function PlanFormFields({ value, onChange, errors, plan }: PlanFormFieldsProps) {
  return (
    <>
      <Section title="Datos del plan">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Nombre"
              placeholder="Caja Esencial"
              value={value.name}
              onChange={(e) => onChange({ name: e.target.value })}
              error={errors.name}
              maxLength={120}
            />
            <Input
              label="Descripción corta"
              placeholder="Tres básicos de skincare cada mes."
              helper="Opcional. Se muestra en el catálogo de planes."
              value={value.shortDescription}
              onChange={(e) => onChange({ shortDescription: e.target.value })}
              error={errors.shortDescription}
              maxLength={300}
            />
          </div>
          <Textarea
            label="Descripción"
            placeholder="Cada mes recibes una selección curada de tres productos de tamaño completo para tu rutina de día y de noche."
            value={value.description}
            onChange={(e) => onChange({ description: e.target.value })}
            error={errors.description}
            maxLength={2000}
          />
        </div>
      </Section>

      <Section title="Qué incluye">
        <p className="mb-4 text-body-sm text-muted-foreground-strong">
          Viñetas cortas que la clienta ve en el catálogo de planes. Describen el plan en general;
          lo que trae la caja de cada mes se arma aparte, en &ldquo;Cajas por mes&rdquo;.
        </p>
        <PlanHighlightsEditor
          value={value.highlights}
          onChange={(highlights) => onChange({ highlights })}
          errors={errors}
        />
      </Section>

      <Section title="Cobro">
        <PlanPriceFields value={value} onChange={onChange} locked={plan !== null} errors={errors} />
      </Section>

      <Section title="Cupo y catálogo">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Cupo de suscriptoras"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="50"
            helper={
              plan
                ? `${plan.seatsTaken} ${plan.seatsTaken === 1 ? "lugar ocupado" : "lugares ocupados"} ahora; no puede quedar por debajo.`
                : "Máximo de suscripciones activas al mismo tiempo."
            }
            value={value.maxActiveSeats}
            onChange={(e) => onChange({ maxActiveSeats: e.target.value })}
            error={errors.maxActiveSeats}
          />
          <Input
            label="Orden en el catálogo"
            type="number"
            inputMode="numeric"
            placeholder="1"
            helper="Número menor aparece primero."
            value={value.sortOrder}
            onChange={(e) => onChange({ sortOrder: e.target.value })}
            error={errors.sortOrder}
          />
        </div>
      </Section>
    </>
  );
}

export { PlanFormFields };
