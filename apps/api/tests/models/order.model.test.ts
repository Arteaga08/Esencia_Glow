import mongoose from "mongoose";
import { OrderPriority, OrderStatus, PaymentMethod, PaymentState } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { Order } from "../../src/models/order.model.js";

function buildOrderAttrs(overrides: Partial<Record<string, unknown>> = {}) {
  const userId = new mongoose.Types.ObjectId();
  return {
    orderNumber: overrides.orderNumber ?? `EG-${new mongoose.Types.ObjectId().toString().slice(-8).toUpperCase()}`,
    userId: overrides.userId ?? userId,
    status: overrides.status ?? OrderStatus.PENDING,
    lines: [
      {
        itemType: "product",
        itemId: new mongoose.Types.ObjectId(),
        sku: "SER-30",
        name: "Sérum Vitamina C",
        variantName: "30ml",
        unitPriceCents: 50000,
        quantity: 2,
        lineTotalCents: 100000,
      },
    ],
    subtotalCents: 100000,
    discountCents: 0,
    taxCents: 13793,
    taxRateBps: 1600,
    shippingCents: 12000,
    totalCents: 112000,
    currency: "MXN",
    payment: { provider: "stripe", method: PaymentMethod.CARD, state: PaymentState.PENDING, captureMethod: "automatic", failedAttempts: 0 },
    shippingAddress: {
      fullName: "Ana Pérez",
      phone: "5512345678",
      street: "Av. Reforma",
      exteriorNumber: "100",
      neighborhood: "Juárez",
      city: "CDMX",
      state: "Ciudad de México",
      postalCode: "06600",
    },
    shippingSelection: {
      rateId: "rate-1",
      carrier: "estafeta",
      service: "standard",
      amountCents: 12000,
      estimatedDays: 3,
    },
    parcel: { weightGrams: 350, lengthCm: 15, widthCm: 15, heightCm: 11, volumetricWeightGrams: 1000 },
    termsAcceptedAt: new Date(),
    reservationId: new mongoose.Types.ObjectId(),
    expiresAt: new Date(Date.now() + 30 * 60_000),
    statusHistory: [{ status: OrderStatus.PENDING, at: new Date(), actorType: "user" }],
    priority: OrderPriority.NORMAL,
    inventoryIncident: false,
    ...overrides,
  };
}

describe("models/Order", () => {
  it("crea una orden válida con todos los campos core", async () => {
    const order = await Order.create(buildOrderAttrs());
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.priority).toBe(OrderPriority.NORMAL);
    expect(order.inventoryIncident).toBe(false);
  });

  it("rechaza un orderNumber duplicado (11000)", async () => {
    const orderNumber = "EG-DUPLICAD";
    await Order.create(buildOrderAttrs({ orderNumber }));
    await expect(Order.create(buildOrderAttrs({ orderNumber }))).rejects.toMatchObject({ code: 11000 });
  });

  it("rechaza {userId, idempotencyKey} duplicados, pero permite la misma key para usuarios distintos", async () => {
    const userId = new mongoose.Types.ObjectId();
    await Order.create(buildOrderAttrs({ userId, idempotencyKey: "11111111-1111-4111-8111-111111111111" }));

    await expect(
      Order.create(buildOrderAttrs({ userId, idempotencyKey: "11111111-1111-4111-8111-111111111111" })),
    ).rejects.toMatchObject({ code: 11000 });

    // Mismo idempotencyKey, usuario distinto: no debe chocar (índice compuesto).
    await expect(
      Order.create(buildOrderAttrs({ idempotencyKey: "11111111-1111-4111-8111-111111111111" })),
    ).resolves.toBeDefined();
  });

  it("no choca por índice de idempotencia entre dos órdenes SIN idempotencyKey del mismo usuario", async () => {
    // Un segundo pedido `pending` del mismo usuario SÍ choca por el índice
    // de "un checkout vivo por cliente" (ver test de abajo) — aquí se aísla
    // la ausencia de `idempotencyKey` usando un estado no-pending para el
    // segundo, así el único índice en juego es el de idempotencia.
    const userId = new mongoose.Types.ObjectId();
    await Order.create(buildOrderAttrs({ userId, orderNumber: "EG-AAAAAAAA" }));
    await expect(
      Order.create(
        buildOrderAttrs({ userId, orderNumber: "EG-BBBBBBBB", status: OrderStatus.CANCELLED }),
      ),
    ).resolves.toBeDefined();
  });

  it("un solo checkout pendiente por usuario: rechaza una segunda orden 'pending' del mismo usuario", async () => {
    const userId = new mongoose.Types.ObjectId();
    await Order.create(buildOrderAttrs({ userId, orderNumber: "EG-CCCCCCCC", status: OrderStatus.PENDING }));

    await expect(
      Order.create(buildOrderAttrs({ userId, orderNumber: "EG-DDDDDDDD", status: OrderStatus.PENDING })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("permite una segunda orden 'paid' del mismo usuario aunque ya tenga una 'pending'", async () => {
    const userId = new mongoose.Types.ObjectId();
    await Order.create(buildOrderAttrs({ userId, orderNumber: "EG-EEEEEEEE", status: OrderStatus.PENDING }));

    await expect(
      Order.create(buildOrderAttrs({ userId, orderNumber: "EG-FFFFFFFF", status: OrderStatus.PAID })),
    ).resolves.toBeDefined();
  });

  it("rechaza un payment.intentId duplicado entre dos órdenes", async () => {
    await Order.create(
      buildOrderAttrs({ orderNumber: "EG-GGGGGGGG", payment: { provider: "stripe", method: PaymentMethod.CARD, state: PaymentState.CAPTURED, captureMethod: "automatic", intentId: "pi_123", failedAttempts: 0 } }),
    );

    await expect(
      Order.create(
        buildOrderAttrs({ orderNumber: "EG-HHHHHHHH", payment: { provider: "stripe", method: PaymentMethod.CARD, state: PaymentState.CAPTURED, captureMethod: "automatic", intentId: "pi_123", failedAttempts: 0 } }),
      ),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("una línea de bundle lleva sus componentes anidados sin sumar al total", async () => {
    const order = await Order.create(
      buildOrderAttrs({
        orderNumber: "EG-IIIIIIII",
        lines: [
          {
            itemType: "bundle",
            itemId: new mongoose.Types.ObjectId(),
            sku: "BUNDLE-1",
            name: "Kit Glow",
            unitPriceCents: 89900,
            quantity: 1,
            lineTotalCents: 89900,
            components: [
              {
                productId: new mongoose.Types.ObjectId(),
                variantId: new mongoose.Types.ObjectId(),
                sku: "SER-30",
                name: "Sérum",
                variantName: "30ml",
                quantity: 1,
                catalogUnitPriceCents: 59900,
              },
            ],
          },
        ],
      }),
    );
    expect(order.lines[0]!.components).toHaveLength(1);
    expect(order.lines[0]!.components![0]!.catalogUnitPriceCents).toBe(59900);
  });
});
