"use client";

import { useState } from "react";
import { CalendarBlank } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format-date";
import { useSubscriptionSettings } from "./use-subscription-settings";
import { handleEnrollmentError } from "./handle-enrollment-error";

const DEFAULT_DURATION_DAYS = 15;

/** ¿Puede darse de alta una clienta AHORA? Mismo cálculo que
 * `isEnrollmentOpen` del backend (subscription-enrollment.ts): la ventana se
 * lee cerrada sola al cumplirse `enrollmentClosesAt`, sin esperar a que
 * nada voltee `enrollmentOpen` — se recalcula en cada render, nunca se
 * cachea. */
function isWindowOpenNow(enrollmentOpen: boolean, enrollmentClosesAt?: string): boolean {
  if (!enrollmentOpen) return false;
  if (enrollmentClosesAt && Date.now() >= new Date(enrollmentClosesAt).getTime()) return false;
  return true;
}

/**
 * Cabecera de Cuentas (Milestone 2.7a): estado de la ventana de
 * inscripciones + día de cobro anclado — el backend ya existe desde
 * 1.7.2a/1.7.2b, esta sesión solo lo expone. Abrir es una acción segura
 * (reabrir después de cerrada no tiene costo) y va inline; cerrar corta el
 * alta de clientas nuevas en producción, así que pide confirmación
 * explícita (PRODUCT.md principio 2).
 */
function EnrollmentWindowPanel() {
  const { settings, loadError, openEnrollment, closeEnrollment, updateBillingAnchorDay } = useSubscriptionSettings();
  const { toast } = useToast();

  const [durationDays, setDurationDays] = useState(String(DEFAULT_DURATION_DAYS));
  const [openConflict, setOpenConflict] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeConflict, setCloseConflict] = useState<string | null>(null);

  const [anchorDayDraft, setAnchorDayDraft] = useState<string | null>(null);
  const [anchorConflict, setAnchorConflict] = useState<string | null>(null);
  const [savingAnchor, setSavingAnchor] = useState(false);

  if (loadError) {
    return (
      <Card className="mb-6">
        <p className="text-body-sm text-destructive-action">{loadError}</p>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card className="mb-6">
        <Skeleton className="h-10 w-full" />
      </Card>
    );
  }

  const open = isWindowOpenNow(settings.enrollmentOpen, settings.enrollmentClosesAt);
  const anchorDayValue = anchorDayDraft ?? String(settings.billingAnchorDay);
  const anchorDayChanged = Number(anchorDayValue) !== settings.billingAnchorDay;

  async function handleOpen() {
    setOpening(true);
    setOpenConflict(null);
    try {
      const days = durationDays.trim() ? Number(durationDays) : undefined;
      await openEnrollment(days);
      toast({ variant: "success", title: "Inscripciones abiertas." });
    } catch (error) {
      handleEnrollmentError({ error, setConflict: setOpenConflict, toast, title: "No se pudo abrir la ventana" });
    } finally {
      setOpening(false);
    }
  }

  async function handleClose() {
    setClosing(true);
    setCloseConflict(null);
    try {
      await closeEnrollment();
      toast({ variant: "success", title: "Inscripciones cerradas." });
      setCloseOpen(false);
    } catch (error) {
      handleEnrollmentError({ error, setConflict: setCloseConflict, toast, title: "No se pudo cerrar la ventana" });
    } finally {
      setClosing(false);
    }
  }

  async function handleSaveAnchorDay() {
    setSavingAnchor(true);
    setAnchorConflict(null);
    try {
      await updateBillingAnchorDay(Number(anchorDayValue));
      setAnchorDayDraft(null);
      toast({ variant: "success", title: "Día de cobro actualizado." });
    } catch (error) {
      handleEnrollmentError({ error, setConflict: setAnchorConflict, toast, title: "No se pudo cambiar el día de cobro" });
    } finally {
      setSavingAnchor(false);
    }
  }

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-3">
          <CalendarBlank className="mt-0.5 size-5 text-muted-foreground-strong" aria-hidden="true" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-subtitle text-foreground">Ventana de inscripciones</p>
              <Badge color={open ? "success" : "neutral"}>{open ? "Abierta" : "Cerrada"}</Badge>
            </div>
            <p className="mt-1 text-body-sm text-muted-foreground-strong">
              {open && settings.enrollmentClosesAt
                ? `Abierta hasta ${formatDateTime(settings.enrollmentClosesAt)}.`
                : open
                  ? "Abierta sin fecha de cierre."
                  : "Nadie puede darse de alta ahora mismo."}{" "}
              Cobro anclado el día {settings.billingAnchorDay} de cada mes.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Input
              label="Día de cobro"
              type="number"
              min={1}
              max={28}
              value={anchorDayValue}
              onChange={(event) => setAnchorDayDraft(event.target.value)}
              error={anchorConflict ?? undefined}
            />
          </div>
          {anchorDayChanged ? (
            <Button variant="secondary" size="sm" loading={savingAnchor} onClick={handleSaveAnchorDay}>
              Guardar día
            </Button>
          ) : null}

          {open ? (
            <Button variant="destructive" size="sm" onClick={() => setCloseOpen(true)}>
              Cerrar inscripciones
            </Button>
          ) : (
            <>
              <div className="w-32">
                <Input
                  label="Días abierta"
                  type="number"
                  min={1}
                  max={90}
                  placeholder={String(DEFAULT_DURATION_DAYS)}
                  value={durationDays}
                  onChange={(event) => setDurationDays(event.target.value)}
                />
              </div>
              <Button variant="primary" loading={opening} onClick={handleOpen}>
                Abrir inscripciones
              </Button>
            </>
          )}
        </div>
      </div>

      {openConflict ? <FieldError message={openConflict} /> : null}

      <ConfirmModal
        open={closeOpen}
        title="Cerrar inscripciones"
        confirmLabel="Cerrar inscripciones"
        variant="destructive"
        loading={closing}
        error={closeConflict}
        onCancel={() => setCloseOpen(false)}
        onConfirm={handleClose}
      >
        <p className="text-body-sm text-muted-foreground-strong">
          Ninguna clienta nueva podrá darse de alta hasta que vuelvas a abrir la ventana. Las suscripciones ya
          activas no se ven afectadas.
        </p>
      </ConfirmModal>
    </Card>
  );
}

export { EnrollmentWindowPanel, isWindowOpenNow };
