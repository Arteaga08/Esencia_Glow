import { randomUUID } from "node:crypto";
import { OrderStatus, ProductStatus, ShippingCarrier } from "@esencia-glow/shared";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { Product } from "../../src/models/product.model.js";
import { __setPaymentProviderForTests } from "../../src/services/payment-provider.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";
import { CHECKOUT_DESTINATION } from "../helpers/checkout-fixtures.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import { buildStripeEvent, signPayload } from "../helpers/stripe-webhook-fixtures.js";

const app = buildApp();

/**
 * Golden path de checkout (verificación de cierre de 1.5, extendido en
 * 1.6.2 con el webhook real en vez de `markOrderPaid` directo): cotizar
 * envío -> crear orden (con intent) -> `reserved` sube -> webhook
 * `payment_intent.succeeded` firmado -> `onHand`/`reserved` bajan ->
 * transiciones admin hasta `delivered`. Cubre el flujo completo end-to-end
 * sobre `buildApp()`, en vez de una pieza aislada por test.
 */
describe("golden path — checkout completo hasta delivered", () => {
  it("recorre cotización -> orden -> pago -> processing -> shipped -> delivered", async () => {
    const category = await Category.create({ name: "Cat Golden", slug: "cat-golden" });
    const product = await Product.create({
      name: "Producto Golden",
      slug: "producto-golden",
      description: "d",
      categoryId: category._id,
      status: ProductStatus.ACTIVE,
      variants: [
        {
          sku: "SKU-GOLDEN",
          name: "Variante",
          price: 50000,
          weightGrams: 200,
          dimensionsCm: { length: 10, width: 10, height: 10 },
          isActive: true,
        },
      ],
    });
    const variant = product.variants[0]!;
    await Inventory.create({ productId: product._id, variantId: variant._id, sku: variant.sku, onHand: 10, reserved: 0 });

    const { agent: customer } = await createCustomerSession(app);

    // 1. Cotizar envío.
    const quoteRes = await customer.post("/api/v1/shipping/quotes").send({
      destination: CHECKOUT_DESTINATION,
      lines: [{ itemType: "product", itemId: variant._id.toString(), quantity: 2 }],
    });
    expect(quoteRes.status).toBe(201);
    const { id: quoteId, rates } = quoteRes.body.data;

    // 2. Crear la orden.
    const orderRes = await customer
      .post("/api/v1/orders")
      .set("Idempotency-Key", randomUUID())
      .send({
        lines: [{ itemType: "product", itemId: variant._id.toString(), quantity: 2 }],
        quoteId,
        rateId: rates[0].rateId,
        paymentMethod: "card",
        termsAccepted: true,
      });
    expect(orderRes.status).toBe(201);
    const order = orderRes.body.data.order;
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.totals.subtotalCents).toBe(100000);

    // 3. `reserved` sube en el servidor, no lo dijo el cliente.
    let inventory = await Inventory.findOne({ variantId: variant._id });
    expect(inventory?.reserved).toBe(2);
    expect(inventory?.onHand).toBe(10);

    // 4. Pago vía webhook real de Stripe (Milestone 1.6.2): firma el
    // evento con el mismo secreto que usa el proveedor falso por defecto
    // de la suite, contra el `intentId` real que dejó el checkout.
    const orderDoc = await Order.findById(order.id).lean();
    const intentId = orderDoc!.payment.intentId!;
    __setPaymentProviderForTests(
      buildFakePaymentProvider({
        getAuthorization: vi.fn().mockResolvedValue({
          intentId,
          status: "captured",
          amountCents: order.totals.totalCents,
          currency: orderDoc!.currency,
          card: { brand: "visa", last4: "4242" },
        }),
      }),
    );
    const eventPayload = buildStripeEvent("payment_intent.succeeded", intentId);
    const signature = signPayload(eventPayload);
    const webhookRes = await request(app)
      .post("/api/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(eventPayload);
    expect(webhookRes.status).toBe(200);

    // 5. onHand/reserved bajan tras el commit.
    inventory = await Inventory.findOne({ variantId: variant._id });
    expect(inventory?.onHand).toBe(8);
    expect(inventory?.reserved).toBe(0);

    // 6. Transiciones admin: paid -> processing -> shipped -> delivered.
    const { agent: admin } = await createAdminSession(app);

    const toProcessing = await admin.patch(`/api/v1/admin/orders/${order.id}/status`).send({ status: OrderStatus.PROCESSING });
    expect(toProcessing.status).toBe(200);
    expect(toProcessing.body.data.status).toBe(OrderStatus.PROCESSING);

    const toShipped = await admin.patch(`/api/v1/admin/orders/${order.id}/status`).send({
      status: OrderStatus.SHIPPED,
      shipment: { carrier: ShippingCarrier.FEDEX, trackingNumber: "GOLDEN-TRACK" },
    });
    expect(toShipped.status).toBe(200);
    expect(toShipped.body.data.shipment.trackingNumber).toBe("GOLDEN-TRACK");

    const toDelivered = await admin.patch(`/api/v1/admin/orders/${order.id}/status`).send({ status: OrderStatus.DELIVERED });
    expect(toDelivered.status).toBe(200);
    expect(toDelivered.body.data.status).toBe(OrderStatus.DELIVERED);

    // 7. El cliente ve el estado final y su propia bitácora.
    const finalRes = await customer.get(`/api/v1/orders/${order.id}`);
    expect(finalRes.body.data.status).toBe(OrderStatus.DELIVERED);
    expect(finalRes.body.data.statusHistory.map((h: { status: string }) => h.status)).toEqual([
      OrderStatus.PENDING,
      OrderStatus.PAID,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ]);
  });
});
