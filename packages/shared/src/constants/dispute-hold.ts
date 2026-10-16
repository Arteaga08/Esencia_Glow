import { DisputeStatus } from "../enums/dispute-status.js";

/**
 * Estados de contracargo que RETIENEN el envío (auditoría run-2, hallazgo 18):
 * no se compra la guía sola, no se despacha (`paid -> processing`,
 * `processing -> shipped`) ni el rastreo arrastra la orden. `OPEN` mientras se
 * disputa; `LOST` porque el dinero ya se revirtió y enviar la mercancía le
 * daría a la titular el reembolso Y el producto. `WON` y `WITHDRAWN` liberan.
 */
const FULFILMENT_HOLD_DISPUTE_STATUSES: readonly DisputeStatus[] = [DisputeStatus.OPEN, DisputeStatus.LOST];

function isFulfilmentHoldDispute(status: DisputeStatus | undefined): boolean {
  return status !== undefined && FULFILMENT_HOLD_DISPUTE_STATUSES.includes(status);
}

export { FULFILMENT_HOLD_DISPUTE_STATUSES, isFulfilmentHoldDispute };
