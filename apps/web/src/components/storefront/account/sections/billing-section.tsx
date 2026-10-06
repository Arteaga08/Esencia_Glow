"use client";

import { Receipt } from "@phosphor-icons/react";
import { useState } from "react";
import { CFDI_USES, FISCAL_REGIMES, type AccountDto, type BillingInfo } from "@esencia-glow/shared";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { accountRequest } from "@/lib/storefront/account-api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { Block, DataList, Notice } from "../shared/frame";
import { CTA_SECONDARY, ROW_ACTION } from "../shared/styles";
import { BillingForm } from "./billing-form";

const labelOf = (options: readonly { value: string; label: string }[], value: string | null) => options.find((option) => option.value === value)?.label ?? null;

/** Datos de facturación: vacío, capturado y editando. Se capturan, no se timbran. */
function BillingSection({ initial }: { initial: BillingInfo | null }) {
  const [billing, setBilling] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await accountRequest<AccountDto>("/api/v1/account/billing-info", { method: "DELETE" });
      setBilling(null);
      setConfirmDelete(false);
      setNotice("Eliminamos tus datos fiscales.");
    } catch (caught) {
      setDeleteError(classifyError(caught).message);
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <Block title={billing ? "Editar datos fiscales" : "Datos fiscales"}>
        <BillingForm
          initial={billing ?? undefined}
          onSaved={(saved) => {
            setBilling(saved);
            setEditing(false);
            setNotice("Guardamos tus datos fiscales.");
          }}
          onCancel={() => setEditing(false)}
        />
      </Block>
    );
  }

  if (!billing) {
    return (
      <>
        {notice ? <Notice>{notice}</Notice> : null}
        <EmptyState
          icon={Receipt}
          title="No has guardado datos fiscales"
          description="Son opcionales. Guárdalos una vez y los tendremos listos. Por ahora solo los almacenamos, no emitimos facturas."
          action={
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setEditing(true);
              }}
              className={CTA_SECONDARY}
            >
              Agregar datos fiscales
            </button>
          }
        />
      </>
    );
  }

  return (
    <div>
      {notice ? <Notice>{notice}</Notice> : null}
      <Block
        title="Datos fiscales"
        action={
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setEditing(true);
            }}
            className={ROW_ACTION}
          >
            Editar
          </button>
        }
      >
        <DataList
          rows={[
            { label: "RFC", value: billing.rfc, mono: true },
            { label: "Razón social", value: billing.legalName },
            { label: "Uso de CFDI", value: labelOf(CFDI_USES, billing.cfdiUse) },
            { label: "Código postal fiscal", value: billing.postalCode, mono: true },
            { label: "Régimen fiscal", value: labelOf(FISCAL_REGIMES, billing.fiscalRegime) },
          ]}
        />
        <p className="mt-6 max-w-[60ch] text-body-sm text-muted-foreground-strong">Guardamos estos datos para tus próximas compras. Por ahora no emitimos facturas con ellos.</p>
        <div className="-mx-1 mt-4">
          <button type="button" onClick={() => setConfirmDelete(true)} className={ROW_ACTION}>
            Eliminar datos fiscales
          </button>
        </div>
      </Block>

      <ConfirmModal
        open={confirmDelete}
        title="Eliminar datos fiscales"
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleting}
        error={deleteError}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      >
        <p className="text-body text-foreground/80">Borraremos tu RFC y el resto de tus datos fiscales. Puedes volver a guardarlos cuando quieras.</p>
      </ConfirmModal>
    </div>
  );
}

export { BillingSection };
