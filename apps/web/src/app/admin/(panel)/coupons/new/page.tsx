import { NewCouponForm } from "@/components/coupons/new-coupon-form";

/** Milestone 3.7 — alta de un cupón público (con límite de personas y usos por clienta). */
export default function NewCouponPage() {
  return (
    <div>
      <h2 className="mb-6 text-page-title text-foreground">Nuevo cupón</h2>
      <NewCouponForm />
    </div>
  );
}
