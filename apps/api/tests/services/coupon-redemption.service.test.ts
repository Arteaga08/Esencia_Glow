import { Types } from "mongoose";
import { CouponDiscountType, CouponKind, ErrorCode } from "@esencia-glow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Coupon } from "../../src/models/coupon.model.js";
import { CouponUsage } from "../../src/models/coupon-usage.model.js";
import { AppError } from "../../src/utils/app-error.js";
import { withTransaction } from "../../src/utils/with-transaction.js";
import { claimCouponUse, releaseCouponUse } from "../../src/services/coupon-redemption.service.js";
import { resetCouponFixtureCounter, seedCoupon, seedCustomer } from "../helpers/coupon-fixtures.js";

/**
 * Canje atómico (Milestone 3.7): los topes se deciden en el MISMO update que
 * incrementa el contador, nunca leyendo y luego escribiendo. Las pruebas de
 * concurrencia disparan reclamos en paralelo contra el motor real.
 */
describe("services/coupon-redemption", () => {
  beforeEach(() => {
    resetCouponFixtureCounter();
  });

  function claim(code: string, userId: string, subtotalCents = 100000) {
    return withTransaction((session) => claimCouponUse({ code, userId, subtotalCents }, session));
  }

  function release(couponId: Types.ObjectId, userId: string) {
    return withTransaction((session) => releaseCouponUse({ couponId, userId }, session));
  }

  async function failureCode(promise: Promise<unknown>): Promise<ErrorCode | undefined> {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      return (error as AppError).code;
    }
    return undefined;
  }

  it("canjea: calcula el descuento, toma un lugar y registra el uso", async () => {
    const coupon = await seedCoupon({ percentOff: 15, maxCustomers: 5 });
    const userId = await seedCustomer();

    const claimed = await claim(coupon.code, userId, 80000);

    expect(claimed.couponId.toString()).toBe(coupon._id.toString());
    expect(claimed.code).toBe(coupon.code);
    expect(claimed.discountCents).toBe(12000);
    expect((await Coupon.findById(coupon._id))?.customersCount).toBe(1);
    expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(1);
  });

  it("normaliza el código (minúsculas y espacios)", async () => {
    const coupon = await seedCoupon();
    const userId = await seedCustomer();
    const claimed = await claim(`  ${coupon.code.toLowerCase()} `, userId);
    expect(claimed.code).toBe(coupon.code);
  });

  it("monto fijo: el descuento sale del monto y queda topado al subtotal", async () => {
    const coupon = await seedCoupon({ discountType: CouponDiscountType.FIXED, percentOff: undefined, amountOffCents: 50000 });
    const userId = await seedCustomer();
    expect((await claim(coupon.code, userId, 30000)).discountCents).toBe(30000);
  });

  it("un código que no existe es COUPON_INVALID", async () => {
    const userId = await seedCustomer();
    expect(await failureCode(claim("NOEXISTE", userId))).toBe(ErrorCode.COUPON_INVALID);
  });

  it("aplica las reglas: vencido, mínimo y dueña de un personal", async () => {
    const userId = await seedCustomer();
    const expired = await seedCoupon({ endsAt: new Date(Date.now() - 60_000) });
    expect(await failureCode(claim(expired.code, userId))).toBe(ErrorCode.COUPON_EXPIRED);

    const withMinimum = await seedCoupon({ minSubtotalCents: 200000 });
    expect(await failureCode(claim(withMinimum.code, userId, 100000))).toBe(ErrorCode.COUPON_MIN_NOT_MET);

    const owner = await seedCustomer();
    const personal = await seedCoupon({ kind: CouponKind.PERSONAL, assignedUserId: new Types.ObjectId(owner), maxCustomers: 1 });
    expect(await failureCode(claim(personal.code, userId))).toBe(ErrorCode.COUPON_INVALID);
    expect((await claim(personal.code, owner)).code).toBe(personal.code);
  });

  it("un rechazo no deja nada tomado", async () => {
    const userId = await seedCustomer();
    const withMinimum = await seedCoupon({ minSubtotalCents: 200000, maxCustomers: 3 });
    await failureCode(claim(withMinimum.code, userId, 100000));
    expect((await Coupon.findById(withMinimum._id))?.customersCount).toBe(0);
    expect(await CouponUsage.countDocuments({ couponId: withMinimum._id })).toBe(0);
  });

  it("tope de usos por clienta: el segundo canje con límite 1 es COUPON_ALREADY_USED y no cuenta otra persona", async () => {
    const coupon = await seedCoupon({ maxCustomers: 5 });
    const userId = await seedCustomer();
    await claim(coupon.code, userId);
    expect(await failureCode(claim(coupon.code, userId))).toBe(ErrorCode.COUPON_ALREADY_USED);
    expect((await Coupon.findById(coupon._id))?.customersCount).toBe(1);
    expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(1);
  });

  it("con límite 2 la misma clienta canjea dos veces y cuenta como UNA persona", async () => {
    const coupon = await seedCoupon({ perCustomerLimit: 2, maxCustomers: 5 });
    const userId = await seedCustomer();
    await claim(coupon.code, userId);
    await claim(coupon.code, userId);
    expect(await failureCode(claim(coupon.code, userId))).toBe(ErrorCode.COUPON_ALREADY_USED);
    expect((await Coupon.findById(coupon._id))?.customersCount).toBe(1);
    expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(2);
  });

  it("tope de personas: la clienta que ya lo tiene sigue pudiendo usar sus canjes aunque el tope esté lleno", async () => {
    const coupon = await seedCoupon({ perCustomerLimit: 2, maxCustomers: 1 });
    const first = await seedCustomer();
    const second = await seedCustomer();
    await claim(coupon.code, first);
    expect(await failureCode(claim(coupon.code, second))).toBe(ErrorCode.COUPON_EXHAUSTED);
    await expect(claim(coupon.code, first)).resolves.toBeDefined();
  });

  it("CONCURRENCIA: 8 clientas distintas sobre un tope de 3 → exactamente 3 ganan", async () => {
    const coupon = await seedCoupon({ maxCustomers: 3 });
    const users = await Promise.all(Array.from({ length: 8 }, () => seedCustomer()));

    const results = await Promise.allSettled(users.map((userId) => claim(coupon.code, userId)));

    const winners = results.filter((result) => result.status === "fulfilled");
    const losers = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(winners).toHaveLength(3);
    for (const loser of losers) {
      expect((loser.reason as AppError).code).toBe(ErrorCode.COUPON_EXHAUSTED);
    }
    expect((await Coupon.findById(coupon._id))?.customersCount).toBe(3);
    expect(await CouponUsage.countDocuments({ couponId: coupon._id, uses: { $gt: 0 } })).toBe(3);
  });

  it("CONCURRENCIA: la misma clienta con 4 canjes en paralelo y límite 1 → solo uno gana", async () => {
    const coupon = await seedCoupon({ maxCustomers: 10 });
    const userId = await seedCustomer();

    const results = await Promise.allSettled(Array.from({ length: 4 }, () => claim(coupon.code, userId)));

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(1);
    expect(await CouponUsage.countDocuments({ couponId: coupon._id, userId })).toBe(1);
    expect((await Coupon.findById(coupon._id))?.customersCount).toBe(1);
  });

  it("si la transacción falla DESPUÉS del canje, no queda ningún uso tomado", async () => {
    const coupon = await seedCoupon({ maxCustomers: 2 });
    const userId = await seedCustomer();

    await expect(
      withTransaction(async (session) => {
        await claimCouponUse({ code: coupon.code, userId, subtotalCents: 100000 }, session);
        throw new AppError("Sin stock.", 409);
      }),
    ).rejects.toBeInstanceOf(AppError);

    expect((await Coupon.findById(coupon._id))?.customersCount).toBe(0);
    expect(await CouponUsage.countDocuments({ couponId: coupon._id })).toBe(0);
  });

  describe("releaseCouponUse", () => {
    it("devuelve el uso y el lugar de persona, y se puede volver a canjear", async () => {
      const coupon = await seedCoupon({ maxCustomers: 1 });
      const userId = await seedCustomer();
      await claim(coupon.code, userId);

      const released = await release(coupon._id, userId);

      expect(released).toBe(true);
      expect((await Coupon.findById(coupon._id))?.customersCount).toBe(0);
      expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(0);
      const another = await seedCustomer();
      await expect(claim(coupon.code, another)).resolves.toBeDefined();
    });

    it("con 2 usos, liberar uno conserva el lugar de persona", async () => {
      const coupon = await seedCoupon({ perCustomerLimit: 2, maxCustomers: 1 });
      const userId = await seedCustomer();
      await claim(coupon.code, userId);
      await claim(coupon.code, userId);

      await release(coupon._id, userId);

      expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(1);
      expect((await Coupon.findById(coupon._id))?.customersCount).toBe(1);
    });

    it("liberar de más es inofensivo: nunca deja contadores negativos", async () => {
      const coupon = await seedCoupon({ maxCustomers: 2 });
      const userId = await seedCustomer();
      await claim(coupon.code, userId);

      expect(await release(coupon._id, userId)).toBe(true);
      expect(await release(coupon._id, userId)).toBe(false);

      expect((await Coupon.findById(coupon._id))?.customersCount).toBe(0);
      expect((await CouponUsage.findOne({ couponId: coupon._id, userId }))?.uses).toBe(0);
    });

    it("CONCURRENCIA: dos liberaciones simultáneas del mismo uso liberan una sola vez", async () => {
      const coupon = await seedCoupon({ maxCustomers: 5 });
      const userId = await seedCustomer();
      const other = await seedCustomer();
      await claim(coupon.code, userId);
      await claim(coupon.code, other);

      const results = await Promise.all([release(coupon._id, userId), release(coupon._id, userId)]);

      expect(results.filter(Boolean)).toHaveLength(1);
      // La otra clienta conserva su lugar: el contador no se decrementó dos veces.
      expect((await Coupon.findById(coupon._id))?.customersCount).toBe(1);
    });
  });
});
