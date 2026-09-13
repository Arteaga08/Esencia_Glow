import { Schema, type Types } from "mongoose";
import { SubscriptionStatus } from "@esencia-glow/shared";

/**
 * Entrada del historial de estado de una `SubscriptionAccount`. Sub-schema
 * propio (igual que `orderStatusHistoryEntrySchema`) para no crecer el
 * modelo — se acota con `MAX_SUBSCRIPTION_STATUS_HISTORY` en el schema
 * padre, mismo criterio anti-DoS que `MAX_STATUS_HISTORY` de `Order`.
 */
interface SubscriptionStatusHistoryEntryAttrs {
  status: SubscriptionStatus;
  at: Date;
  actorType: "user" | "system";
  actorId?: Types.ObjectId;
  reason?: string;
}

const subscriptionStatusHistoryEntrySchema = new Schema<SubscriptionStatusHistoryEntryAttrs>(
  {
    status: { type: String, required: true, enum: Object.values(SubscriptionStatus) },
    at: { type: Date, required: true },
    actorType: { type: String, required: true, enum: ["user", "system"] },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

export { subscriptionStatusHistoryEntrySchema };
export type { SubscriptionStatusHistoryEntryAttrs };
