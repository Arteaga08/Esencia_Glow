import { randomUUID } from "node:crypto";
import { authenticator } from "otplib";
import { OrderStatus, ProductStatus, ShippingCarrier } from "@esencia-glow/shared";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Order } from "../../src/models/order.model.js";
import { Product } from "../../src/models/product.model.js";
import { __setPaymentProviderForTests } from "../../src/services/payment-provider.js";
import { createAdminSession, createCustomerSession, enableAdminTwoFactor } from "../helpers/admin-session.js";
import { CHECKOUT_DESTINATION } from "../helpers/checkout-fixtures.js";
import { buildFakePaymentProvider } from "../helpers/fake-payment-provider.js";
import {
  buildStripeChargeEvent,
  buildStripeDisputeEvent,
  buildStripeEvent,
  signPayload,
} from "../helpers/stripe-webhook-fixtures.js";

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

  it("checkout -> pagado -> processing -> reembolso -> webhook charge.refunded -> refunded + restock; disputa bloquea processing->shipped", async () => {
    const category = await Category.create({ name: "Cat Refund", slug: "cat-refund" });
    const product = await Product.create({
      name: "Producto Refund",
      slug: "producto-refund",
      description: "d",
      categoryId: category._id,
      status: ProductStatus.ACTIVE,
      variants: [
        {
          sku: "SKU-REFUND",
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
    const quoteRes = await customer.post("/api/v1/shipping/quotes").send({
      destination: CHECKOUT_DESTINATION,
      lines: [{ itemType: "product", itemId: variant._id.toString(), quantity: 2 }],
    });
    const { id: quoteId, rates } = quoteRes.body.data;

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
    const order = orderRes.body.data.order;

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
    const paidPayload = buildStripeEvent("payment_intent.succeeded", intentId);
    const paidWebhookRes = await request(app)
      .post("/api/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signPayload(paidPayload))
      .send(paidPayload);
    expect(paidWebhookRes.status).toBe(200);

    const { agent: admin, adminId } = await createAdminSession(app);
    const secret = await enableAdminTwoFactor(adminId);
    const toProcessing = await admin.patch(`/api/v1/admin/orders/${order.id}/status`).send({ status: OrderStatus.PROCESSING });
    expect(toProcessing.status).toBe(200);

    // Disputa (webhook `charge.dispute.created`): bloquea processing -> shipped.
    const disputePayload = buildStripeDisputeEvent("charge.dispute.created", "dp_golden", { paymentIntentId: intentId });
    const disputeRes = await request(app)
      .post("/api/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signPayload(disputePayload))
      .send(disputePayload);
    expect(disputeRes.status).toBe(200);

    const blockedShip = await admin.patch(`/api/v1/admin/orders/${order.id}/status`).send({
      status: OrderStatus.SHIPPED,
      shipment: { carrier: ShippingCarrier.FEDEX, trackingNumber: "GOLDEN-REFUND" },
    });
    expect(blockedShip.status).toBe(409);

    // Disputa ganada (webhook `charge.dispute.closed`): desbloquea de nuevo,
    // pero este golden path sigue el camino de reembolso, no de envío.
    const disputeClosedPayload = buildStripeDisputeEvent("charge.dispute.closed", "dp_golden", {
      paymentIntentId: intentId,
      status: "won",
    });
    await request(app)
      .post("/api/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signPayload(disputeClosedPayload))
      .send(disputeClosedPayload);

    // Reembolso: step-up 2FA + endpoint admin -> 202.
    const refundRes = await admin
      .post(`/api/v1/admin/orders/${order.id}/refund`)
      .send({ twoFactorCode: authenticator.generate(secret), reason: "Cliente se arrepintió" });
    expect(refundRes.status).toBe(202);
    const afterRequest = await Order.findById(order.id).lean();
    expect(afterRequest!.payment.refundRequestedAt).toBeInstanceOf(Date);

    // Stripe confirma: webhook `charge.refunded` por el total.
    const refundedPayload = buildStripeChargeEvent("charge.refunded", "ch_golden", {
      paymentIntentId: intentId,
      amountRefunded: order.totals.totalCents,
      currency: "mxn",
    });
    const refundedWebhookRes = await request(app)
      .post("/api/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signPayload(refundedPayload))
      .send(refundedPayload);
    expect(refundedWebhookRes.status).toBe(200);

    const finalOrder = await Order.findById(order.id).lean();
    expect(finalOrder!.status).toBe(OrderStatus.REFUNDED);
    expect(finalOrder!.payment.state).toBe("refunded");

    const inventory = await Inventory.findOne({ variantId: variant._id }).lean();
    expect(inventory!.onHand).toBe(10); // restock: vuelve al onHand original
  });
});
