import { Types } from "mongoose";
import { CouponDiscountType, CouponKind } from "@esencia-glow/shared";
import { Coupon, type CouponAttrs, type CouponDocument } from "../../src/models/coupon.model.js";
import { User } from "../../src/models/user.model.js";

let couponCounter = 0;

function resetCouponFixtureCounter(): void {
  couponCounter = 0;
}

/** Usuaria real (los cupones personales y el checkout la necesitan en la base). */
async function seedCustomer(): Promise<string> {
  const id = new Types.ObjectId();
  await User.create({
    _id: id,
    email: `${id.toString()}@example.com`,
    password: "P4ssword!!",
    firstName: "Ana",
    lastName: "Pérez",
    emailVerified: true,
  });
  return id.toString();
}

/** Cupón público de 10% por defecto; cada test sobreescribe lo que le importa. */
async function seedCoupon(overrides: Partial<CouponAttrs> = {}): Promise<CouponDocument> {
  couponCounter += 1;
  return Coupon.create({
    code: `PRUEBA${couponCounter}`,
    kind: CouponKind.PUBLIC,
    description: "Cupón de prueba",
    discountType: CouponDiscountType.PERCENT,
    percentOff: 10,
    isActive: true,
    perCustomerLimit: 1,
    customersCount: 0,
    createdBy: new Types.ObjectId(),
    ...overrides,
  });
}

export { seedCoupon, seedCustomer, resetCouponFixtureCounter };
