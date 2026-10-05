"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CTA_PRIMARY, CTA_SECONDARY } from "./styles";
import { compact } from "./validation";

interface BillingFormProps {
  saveHref: string;
  cancelHref: string;
  /** Datos de partida al editar; vacío al capturar por primera vez. */
  initial?: { rfc: string; legalName: string; cfdiUse: string | null; fiscalRegime: string | null; postalCode: string };
}

const CFDI_OPTIONS = [
  { value: "G01", label: "G01 Adquisición de mercancías" },
  { value: "G03", label: "G03 Gastos en general" },
  { value: "S01", label: "S01 Sin efectos fiscales" },
];

const REGIME_OPTIONS = [
  { value: "605", label: "605 Sueldos y salarios" },
  { value: "612", label: "612 Personas físicas con actividades empresariales" },
  { value: "626", label: "626 Régimen simplificado de confianza" },
];

const RFC_SHAPE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

function validate(rfc: string, legalName: string, postalCode: string) {
  return compact({
    rfc: rfc.length === 0 ? "Falta el RFC." : !RFC_SHAPE.test(rfc) ? "El RFC debe tener 12 o 13 caracteres, por ejemplo LOMM910312AB1." : undefined,
    legalName: legalName.trim().length === 0 ? "Falta el nombre o razón social tal como aparece en tu constancia." : undefined,
    postalCode: postalCode.length !== 5 ? "Escribe los 5 dígitos del código postal fiscal." : undefined,
  });
}

/**
 * Datos de facturación. Todo es opcional de punta a punta: se guardan para no
 * pedirlos de nuevo, pero hoy no se emite ninguna factura con ellos. El CP
 * fiscal puede ser distinto al de envío.
 */
function BillingForm({ saveHref, cancelHref, initial }: BillingFormProps) {
  const router = useRouter();
  const [rfc, setRfc] = useState(initial?.rfc ?? "");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [cfdiUse, setCfdiUse] = useState<string | null>(initial?.cfdiUse ?? null);
  const [regime, setRegime] = useState<string | null>(initial?.fiscalRegime ?? null);
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate(rfc, legalName, postalCode);
    setErrors(found);
    if (Object.keys(found).length === 0) router.push(saveHref);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-xl flex-col gap-5">
      <Input label="RFC" value={rfc} onChange={(event) => setRfc(event.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="LOMM910312AB1" maxLength={13} autoCapitalize="characters" error={errors.rfc} />
      <Input label="Nombre o razón social" value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="María Fernanda López Martínez" error={errors.legalName} />
      <Select label="Uso de CFDI" value={cfdiUse} onChange={setCfdiUse} options={CFDI_OPTIONS} placeholder="G03 Gastos en general" />
      <Select label="Régimen fiscal" value={regime} onChange={setRegime} options={REGIME_OPTIONS} placeholder="612 Personas físicas con actividades empresariales" />
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
        <button type="submit" className={CTA_PRIMARY}>
          Guardar datos
        </button>
        <Link href={cancelHref} className={CTA_SECONDARY}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export { BillingForm };
