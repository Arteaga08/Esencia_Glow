import type { CartLineInput, CouponPreview } from "@esencia-glow/shared";
import { accountRequest } from "../account-api";
import { classifyError } from "../auth-errors";
import { couponFailureMessage, isCouponRuleFailure, normalizeCouponInput } from "./coupon-errors";

/** `rejected`: el servidor dijo que el cupón ya no aplica (a diferencia de un fallo de red o de sesión). */
type CouponCheck = { ok: true; preview: CouponPreview } | { ok: false; message: string; unauthorized: boolean; rejected: boolean };

interface ValidateCouponInput {
  code: string;
  lines: CartLineInput[];
}

/** Vista previa del descuento (`POST /coupons/validate`): solo lee, el canje real ocurre al crear el pedido. */
async function validateCoupon({ code, lines }: ValidateCouponInput): Promise<CouponCheck> {
  try {
    const response = await accountRequest<CouponPreview>("/api/v1/coupons/validate", {
      method: "POST",
      body: { code: normalizeCouponInput(code), lines },
      redirectOnFailure: false,
    });
    return { ok: true, preview: response.data };
  } catch (caught) {
    const failure = classifyError(caught);
    return { ok: false, message: couponFailureMessage(failure), unauthorized: failure.kind === "unauthorized", rejected: isCouponRuleFailure(failure) };
  }
}

export { validateCoupon };
export type { CouponCheck, ValidateCouponInput };
