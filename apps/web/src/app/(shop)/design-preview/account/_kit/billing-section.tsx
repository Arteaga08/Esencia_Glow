import Link from "next/link";
import { Receipt } from "@phosphor-icons/react/ssr";
import { EmptyState } from "@/components/ui/empty-state";
import { BillingForm } from "./billing-form";
import type { DemoBilling } from "./fixture";
import { Block, DataList, type Tone } from "./frame";
import { previewHref } from "./preview-state";
import { CTA_SECONDARY, ROW_ACTION } from "./styles";

interface BillingSectionProps {
  tone: Tone;
  state: string | null;
  base: string;
  billing: DemoBilling;
}

/** Datos de facturación: vacío, capturado y editando. Se capturan, no se timbran. */
function BillingSection({ tone, state, base, billing }: BillingSectionProps) {
  const captured = previewHref(base, "facturacion", "capturado");
  const edit = previewHref(base, "facturacion", "editando");
  const empty = previewHref(base, "facturacion");

  if (state === "editando") {
    return (
      <Block tone={tone} title="Editar datos fiscales">
        <BillingForm
          saveHref={captured}
          cancelHref={captured}
          initial={{ rfc: billing.rfc, legalName: billing.legalName, cfdiUse: "G03", fiscalRegime: "612", postalCode: billing.postalCode }}
        />
      </Block>
    );
  }

  if (state === "capturado") {
    return (
      <Block
        tone={tone}
        title="Datos fiscales"
        action={
          <Link href={edit} className={ROW_ACTION}>
            Editar
          </Link>
        }
      >
        <DataList
          rows={[
            { label: "RFC", value: billing.rfc, mono: true },
            { label: "Razón social", value: billing.legalName },
            { label: "Uso de CFDI", value: billing.cfdiUse },
            { label: "Código postal fiscal", value: billing.postalCode, mono: true },
            { label: "Régimen fiscal", value: billing.fiscalRegime },
          ]}
        />
        <p className="mt-6 max-w-[60ch] text-body-sm text-muted-foreground-strong">Guardamos estos datos para tus próximas compras. Por ahora no emitimos facturas con ellos.</p>
        <div className="-mx-1 mt-4">
          <Link href={empty} className={ROW_ACTION}>
            Eliminar datos fiscales
          </Link>
        </div>
      </Block>
    );
  }

  return (
    <EmptyState
      icon={Receipt}
      title="No has guardado datos fiscales"
      description="Son opcionales. Guárdalos una vez y los tendremos listos. Por ahora solo los almacenamos, no emitimos facturas."
      action={
        <Link href={edit} className={CTA_SECONDARY}>
          Agregar datos fiscales
        </Link>
      }
    />
  );
}

export { BillingSection };
