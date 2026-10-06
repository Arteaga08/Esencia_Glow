"use client";

import { useState, type FormEvent } from "react";
import { CFDI_USES, FISCAL_REGIMES, RFC_PATTERN, type AccountDto, type BillingInfo } from "@esencia-glow/shared";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { accountRequest } from "@/lib/storefront/account-api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { CTA_DISABLED, CTA_PRIMARY, CTA_SECONDARY } from "../shared/styles";
import { compact } from "../shared/validation";

interface BillingFormProps {
  /** Datos de partida al editar; sin ellos se captura por primera vez. */
  initial?: BillingInfo;
  onSaved: (info: BillingInfo | null) => void;
  onCancel: () => void;
}

const CFDI_OPTIONS = CFDI_USES.map((option) => ({ ...option }));
const REGIME_OPTIONS = FISCAL_REGIMES.map((option) => ({ ...option }));

function validate(rfc: string, legalName: string, postalCode: string) {
  return compact({
    rfc: rfc.length === 0 ? "Falta el RFC." : !RFC_PATTERN.test(rfc) ? "El RFC debe tener 12 o 13 caracteres, por ejemplo LOMM910312AB1." : undefined,
    legalName: legalName.trim().length === 0 ? "Falta el nombre o razón social tal como aparece en tu constancia." : undefined,
    postalCode: postalCode.length !== 5 ? "Escribe los 5 dígitos del código postal fiscal." : undefined,
  });
}

/**
 * Datos de facturación. Se guardan para no pedirlos de nuevo, pero hoy no se
 * emite ninguna factura con ellos. El CP fiscal puede ser distinto al de envío.
 */
function BillingForm({ initial, onSaved, onCancel }: BillingFormProps) {
  const [rfc, setRfc] = useState(initial?.rfc ?? "");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [cfdiUse, setCfdiUse] = useState<string | null>(initial?.cfdiUse ?? null);
  const [regime, setRegime] = useState<string | null>(initial?.fiscalRegime ?? null);
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const found = validate(rfc, legalName, postalCode);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const result = await accountRequest<AccountDto>("/api/v1/account/billing-info", {
        method: "PUT",
        body: { rfc, legalName: legalName.trim(), cfdiUse, fiscalRegime: regime, postalCode },
      });
      onSaved(result.data.billingInfo);
    } catch (caught) {
      const failure = classifyError(caught);
      if (Object.keys(failure.fieldErrors).length > 0) setErrors(failure.fieldErrors);
      else setFormError(failure.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={saving} className="flex max-w-xl flex-col gap-5">
      {formError ? <FieldError message={formError} /> : null}
      <Input label="RFC" value={rfc} onChange={(event) => setRfc(event.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="LOMM910312AB1" maxLength={13} autoCapitalize="characters" error={errors.rfc} />
      <Input label="Nombre o razón social" value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="María Fernanda López Martínez" error={errors.legalName} />
      <Select label="Uso de CFDI (opcional)" value={cfdiUse} onChange={setCfdiUse} options={CFDI_OPTIONS} placeholder="G03 Gastos en general" error={errors.cfdiUse} />
      <Select label="Régimen fiscal (opcional)" value={regime} onChange={setRegime} options={REGIME_OPTIONS} placeholder="612 Personas físicas con actividades empresariales" error={errors.fiscalRegime} />
      <Input
        label="Código postal fiscal"
        value={postalCode}
        onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, ""))}
        placeholder="44160"
        inputMode="numeric"
        maxLength={5}
        helper="Es el de tu constancia de situación fiscal; puede ser distinto al de envío."
        error={errors.postalCode}
      />
      <div className="flex flex-wrap gap-3">
        {saving ? (
          <span className={CTA_DISABLED}>Guardando…</span>
        ) : (
          <button type="submit" className={CTA_PRIMARY}>
            Guardar datos
          </button>
        )}
        <button type="button" onClick={onCancel} className={CTA_SECONDARY}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export { BillingForm };
