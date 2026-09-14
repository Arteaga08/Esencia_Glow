import {
  SUBSCRIPTION_ANCHOR_GAP_DAYS,
  SUBSCRIPTION_ENROLLMENT_DEFAULT_DAYS,
  type SubscriptionSettings,
} from "@esencia-glow/shared";
import { Settings } from "../models/settings.model.js";
import { getSettings } from "./settings.service.js";
import { assertWindowClearOfAnchor } from "./subscription-enrollment.js";

const SETTINGS_ID = "global";
const DAY_MS = 24 * 60 * 60 * 1000;

interface OpenEnrollmentInput {
  durationDays?: number;
}

/**
 * Abre la ventana de inscripciones (I/O — orquesta el guard puro de
 * subscription-enrollment.ts sobre el singleton de Settings). `durationDays`
 * ausente usa el default de 15 días (decisión de Manuel). El guard corre
 * ANTES de escribir: una ventana que se traslapa con el próximo cobro
 * anclado nunca llega a persistirse.
 */
async function openEnrollment(input: OpenEnrollmentInput): Promise<SubscriptionSettings> {
  const current = await getSettings();
  const now = new Date();
  const durationDays = input.durationDays ?? SUBSCRIPTION_ENROLLMENT_DEFAULT_DAYS;
  const closesAt = new Date(now.getTime() + durationDays * DAY_MS);

  assertWindowClearOfAnchor(now, closesAt, current.subscriptions.billingAnchorDay, SUBSCRIPTION_ANCHOR_GAP_DAYS);

  await Settings.findOneAndUpdate(
    { _id: SETTINGS_ID },
    {
      $set: {
        "subscriptions.enrollmentOpen": true,
        "subscriptions.enrollmentOpenedAt": now,
        "subscriptions.enrollmentClosesAt": closesAt,
      },
    },
    { upsert: true },
  );

  const settings = await getSettings();
  return settings.subscriptions;
}

/** Cierre manual antes de que se cumpla `enrollmentClosesAt`. Deja
 * `enrollmentOpenedAt`/`enrollmentClosesAt` como quedaron — son el rastro de
 * cuándo se abrió y hasta cuándo estaba programada, y no afectan
 * `isEnrollmentOpen` una vez que `enrollmentOpen` es `false`. */
async function closeEnrollment(): Promise<SubscriptionSettings> {
  await Settings.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $set: { "subscriptions.enrollmentOpen": false } },
    { upsert: true },
  );

  const settings = await getSettings();
  return settings.subscriptions;
}

export { openEnrollment, closeEnrollment };
export type { OpenEnrollmentInput };
