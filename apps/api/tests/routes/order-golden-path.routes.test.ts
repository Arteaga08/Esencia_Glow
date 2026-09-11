import { randomUUID } from "node:crypto";
import { OrderStatus, ProductStatus, ShippingCarrier } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { Category } from "../../src/models/category.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { Product } from "../../src/models/product.model.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";
import { CHECKOUT_DESTINATION } from "../helpers/checkout-fixtures.js";

const app = buildApp();

/**
 * Golden path de checkout (verificación de cierre del plan de 1.5): cotizar
 * envío -> crear orden -> `reserved` sube y los totales son los del
 * servidor -> `markOrderPaid` -> `onHand`/`reserved` bajan -> transiciones
 * admin hasta `delivered`. Cubre el flujo completo end-to-end sobre
 * `buildApp()`, en vez de una pieza aislada por test.
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

    // 4. Pago (gancho de 1.6, servicio interno — sin endpoint admin a `paid`).
    const paidResult = await markOrderPaid({ orderId: order.id });
    expect(paidResult.outcome).toBe("paid");

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
