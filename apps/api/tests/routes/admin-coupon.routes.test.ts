import { CouponAction, CouponDiscountType, CouponKind } from "@esencia-glow/shared";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { AuditLog } from "../../src/models/audit-log.model.js";
import { Coupon } from "../../src/models/coupon.model.js";
import { User } from "../../src/models/user.model.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { createAdminSession, createCustomerSession } from "../helpers/admin-session.js";
import { buildFakeMailProvider, type FakeMailProvider } from "../helpers/fake-mail-provider.js";
import { resetCouponFixtureCounter, seedCoupon } from "../helpers/coupon-fixtures.js";

const app = buildApp();

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

const validBody = {
  code: "BIENVENIDA10",
  description: "Para tu primera compra",
  discountType: "percent",
  percentOff: 10,
  maxCustomers: 100,
  perCustomerLimit: 1,
};

describe("routes — /admin/coupons", () => {
  beforeEach(() => {
    resetCouponFixtureCounter();
  });

  it("exige sesión de admin: sin sesión 401, clienta 403", async () => {
    expect((await request(app).get("/api/v1/admin/coupons")).status).toBe(401);
    const { agent } = await createCustomerSession(app);
    expect((await agent.get("/api/v1/admin/coupons")).status).toBe(403);
    expect((await agent.post("/api/v1/admin/coupons").send(validBody)).status).toBe(403);
  });

  describe("POST /admin/coupons", () => {
    it("crea un cupón público, normaliza el código y audita", async () => {
      const { agent, adminId } = await createAdminSession(app);

      const res = await agent.post("/api/v1/admin/coupons").send({ ...validBody, code: " bienvenida10 " });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        code: "BIENVENIDA10",
        kind: CouponKind.PUBLIC,
        discountType: CouponDiscountType.PERCENT,
        percentOff: 10,
        maxCustomers: 100,
        perCustomerLimit: 1,
        customersCount: 0,
        isActive: true,
      });
      expect(res.body.data.assignedUser).toBeUndefined();
      const saved = await Coupon.findOne({ code: "BIENVENIDA10" });
      expect(saved?.createdBy.toString()).toBe(adminId);
      expect(await AuditLog.countDocuments({ action: CouponAction.COUPON_CREATED })).toBe(1);
    });

    it("monto fijo con mínimo y vigencia", async () => {
      const { agent } = await createAdminSession(app);
      const res = await agent.post("/api/v1/admin/coupons").send({
        code: "MENOS100",
        discountType: "fixed",
        amountOffCents: 10000,
        minSubtotalCents: 80000,
        startsAt: "2026-11-01T00:00:00-06:00",
        endsAt: FUTURE,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.amountOffCents).toBe(10000);
      expect(res.body.data.percentOff).toBeUndefined();
      expect(res.body.data.minSubtotalCents).toBe(80000);
      expect(res.body.data.startsAt).toBeDefined();
    });

    it("un código repetido es 409 con el error pegado al campo `code`", async () => {
      const { agent } = await createAdminSession(app);
      await agent.post("/api/v1/admin/coupons").send(validBody);

      const res = await agent.post("/api/v1/admin/coupons").send({ ...validBody, code: "bienvenida10" });

      expect(res.status).toBe(409);
      expect(res.body.errors.code).toBe("Ya existe un cupón con ese código.");
    });

    it.each([
      ["código con espacios o acentos", { code: "MI CÓDIGO" }, "code"],
      ["código muy corto", { code: "AB" }, "code"],
      ["porcentaje en 0", { percentOff: 0 }, "percentOff"],
      ["porcentaje en 101", { percentOff: 101 }, "percentOff"],
      ["porcentaje decimal", { percentOff: 10.5 }, "percentOff"],
      ["porcentaje con monto fijo a la vez", { amountOffCents: 5000 }, "amountOffCents"],
      ["tope de personas en 0", { maxCustomers: 0 }, "maxCustomers"],
      ["usos por clienta en 0", { perCustomerLimit: 0 }, "perCustomerLimit"],
      ["fin antes del inicio", { startsAt: "2026-12-10T00:00:00-06:00", endsAt: "2026-12-01T23:59:00-06:00" }, "endsAt"],
      ["fin ya pasado", { endsAt: "2020-01-01T23:59:00-06:00" }, "endsAt"],
    ])("rechaza %s con 400 y el error en el campo", async (_label, override, field) => {
      const { agent } = await createAdminSession(app);
      const res = await agent.post("/api/v1/admin/coupons").send({ ...validBody, ...override });
      expect(res.status).toBe(400);
      expect(res.body.errors[field]).toBeTruthy();
    });

    it("monto fijo sin amountOffCents es 400", async () => {
      const { agent } = await createAdminSession(app);
      const res = await agent.post("/api/v1/admin/coupons").send({ code: "FIJO1000", discountType: "fixed" });
      expect(res.status).toBe(400);
      expect(res.body.errors.amountOffCents).toBeTruthy();
    });

    it("ignora campos que no son del contrato (kind, customersCount, createdBy)", async () => {
      const { agent } = await createAdminSession(app);
      const res = await agent
        .post("/api/v1/admin/coupons")
        .send({ ...validBody, kind: "personal", customersCount: 50, isActive: false });
      expect(res.status).toBe(201);
      expect(res.body.data.kind).toBe(CouponKind.PUBLIC);
      expect(res.body.data.customersCount).toBe(0);
      expect(res.body.data.isActive).toBe(true);
    });
  });

  describe("GET /admin/coupons", () => {
    it("lista paginado, lo más nuevo primero, con el contador de uso", async () => {
      const { agent } = await createAdminSession(app);
      await seedCoupon({ code: "VIEJO1", customersCount: 3, maxCustomers: 10 });
      await seedCoupon({ code: "NUEVO1" });

      const res = await agent.get("/api/v1/admin/coupons");

      expect(res.status).toBe(200);
      expect(res.body.data.map((row: { code: string }) => row.code)).toEqual(["NUEVO1", "VIEJO1"]);
      expect(res.body.data[1]).toMatchObject({ customersCount: 3, maxCustomers: 10 });
      expect(res.body.meta.total).toBe(2);
    });

    it("filtra por clase, estado y busca por código", async () => {
      const { agent } = await createAdminSession(app);
      const owner = await User.create({ email: "duena@example.com", password: "Contrasena1", firstName: "Lupe", lastName: "Soto", role: "customer", emailVerified: true });
      await seedCoupon({ code: "PUBLICO1" });
      await seedCoupon({ code: "APAGADO1", isActive: false });
      await seedCoupon({ code: "PERSONAL1", kind: CouponKind.PERSONAL, assignedUserId: owner._id, maxCustomers: 1 });

      const personal = await agent.get("/api/v1/admin/coupons?kind=personal");
      expect(personal.body.data.map((row: { code: string }) => row.code)).toEqual(["PERSONAL1"]);
      expect(personal.body.data[0].assignedUser).toEqual({ id: owner._id.toString(), firstName: "Lupe", lastName: "Soto", email: "duena@example.com" });

      const inactive = await agent.get("/api/v1/admin/coupons?status=inactive");
      expect(inactive.body.data.map((row: { code: string }) => row.code)).toEqual(["APAGADO1"]);

      const search = await agent.get("/api/v1/admin/coupons?search=publ");
      expect(search.body.data.map((row: { code: string }) => row.code)).toEqual(["PUBLICO1"]);
    });

    it("un filtro con valor inválido es 400", async () => {
      const { agent } = await createAdminSession(app);
      expect((await agent.get("/api/v1/admin/coupons?kind=otro")).status).toBe(400);
      expect((await agent.get("/api/v1/admin/coupons?status=otro")).status).toBe(400);
    });
  });

  describe("PATCH /admin/coupons/:id", () => {
    it("desactiva y reactiva, y audita cada cambio", async () => {
      const { agent } = await createAdminSession(app);
      const coupon = await seedCoupon();

      const off = await agent.patch(`/api/v1/admin/coupons/${coupon._id}`).send({ isActive: false });
      expect(off.status).toBe(200);
      expect(off.body.data.isActive).toBe(false);
      const on = await agent.patch(`/api/v1/admin/coupons/${coupon._id}`).send({ isActive: true });
      expect(on.body.data.isActive).toBe(true);

      expect(await AuditLog.countDocuments({ action: CouponAction.COUPON_DEACTIVATED })).toBe(1);
      expect(await AuditLog.countDocuments({ action: CouponAction.COUPON_ACTIVATED })).toBe(1);
    });

    it("solo cambia isActive: el valor del cupón no se edita", async () => {
      const { agent } = await createAdminSession(app);
      const coupon = await seedCoupon({ percentOff: 10 });

      await agent.patch(`/api/v1/admin/coupons/${coupon._id}`).send({ isActive: false, percentOff: 90, code: "OTRO1234" });

      const saved = await Coupon.findById(coupon._id);
      expect(saved?.percentOff).toBe(10);
      expect(saved?.code).toBe(coupon.code);
    });

    it("404 si no existe y 400 sin isActive o con id inválido", async () => {
      const { agent } = await createAdminSession(app);
      expect((await agent.patch("/api/v1/admin/coupons/665f1f77bcf86cd799439011").send({ isActive: false })).status).toBe(404);
      const coupon = await seedCoupon();
      expect((await agent.patch(`/api/v1/admin/coupons/${coupon._id}`).send({})).status).toBe(400);
      expect((await agent.patch("/api/v1/admin/coupons/no-es-id").send({ isActive: false })).status).toBe(400);
    });
  });

  describe("POST /admin/customers/:id/coupons (dar cupón)", () => {
    let mail: FakeMailProvider;

    beforeEach(() => {
      mail = buildFakeMailProvider();
      __setMailProviderForTests(mail);
    });

    afterEach(() => {
      __setMailProviderForTests(buildFakeMailProvider());
    });

    async function seedCustomer() {
      return User.create({ email: "clienta@example.com", password: "Contrasena1", firstName: "Mariana", lastName: "López", role: "customer", emailVerified: true });
    }

    it("crea un cupón personal ligado a la clienta y le manda el correo", async () => {
      const { agent } = await createAdminSession(app);
      const customer = await seedCustomer();

      const res = await agent.post(`/api/v1/admin/customers/${customer._id}/coupons`).send({
        code: "GRACIAS15",
        description: "Gracias por estar con nosotras",
        discountType: "percent",
        percentOff: 15,
        perCustomerLimit: 2,
        endsAt: FUTURE,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.emailSent).toBe(true);
      expect(res.body.data.coupon).toMatchObject({
        code: "GRACIAS15",
        kind: CouponKind.PERSONAL,
        maxCustomers: 1,
        perCustomerLimit: 2,
        assignedUser: { id: customer._id.toString(), email: "clienta@example.com" },
      });
      const saved = await Coupon.findOne({ code: "GRACIAS15" });
      expect(saved?.assignedUserId?.toString()).toBe(customer._id.toString());

      expect(mail.calls).toHaveLength(1);
      const sent = mail.calls[0]!;
      expect(sent.to).toBe("clienta@example.com");
      expect(sent.html).toContain("GRACIAS15");
      expect(sent.html).toContain("15% de descuento");
      expect(sent.html).toContain("Gracias por estar con nosotras");
      expect(sent.html).toContain("Mariana");
      expect(await AuditLog.countDocuments({ action: CouponAction.COUPON_GRANTED })).toBe(1);
    });

    it("la descripción escrita por el admin sale escapada en el correo (nunca HTML crudo)", async () => {
      const { agent } = await createAdminSession(app);
      const customer = await seedCustomer();

      await agent.post(`/api/v1/admin/customers/${customer._id}/coupons`).send({
        code: "ESCAPE123",
        description: 'Tú & yo: "gracias" <script>alert(1)</script>',
        discountType: "fixed",
        amountOffCents: 5000,
      });

      const html = mail.calls[0]!.html;
      expect(html).toContain("Tú &amp; yo: &quot;gracias&quot;");
      expect(html).not.toContain("<script");
    });

    it("si el correo no sale, el cupón se crea igual y la respuesta lo dice", async () => {
      const { agent } = await createAdminSession(app);
      const customer = await seedCustomer();
      __setMailProviderForTests({ send: async () => ({ sent: false }) });

      const res = await agent.post(`/api/v1/admin/customers/${customer._id}/coupons`).send({ code: "SINCORREO", discountType: "percent", percentOff: 5 });

      expect(res.status).toBe(201);
      expect(res.body.data.emailSent).toBe(false);
      expect(await Coupon.countDocuments({ code: "SINCORREO" })).toBe(1);
    });

    it("404 si el id es de un admin o no existe (criterio de 2.6)", async () => {
      const { agent, adminId } = await createAdminSession(app);
      const body = { code: "NOCLIENTA", discountType: "percent", percentOff: 5 };
      expect((await agent.post(`/api/v1/admin/customers/${adminId}/coupons`).send(body)).status).toBe(404);
      expect((await agent.post("/api/v1/admin/customers/665f1f77bcf86cd799439011/coupons").send(body)).status).toBe(404);
      expect(await Coupon.countDocuments()).toBe(0);
      expect(mail.calls).toHaveLength(0);
    });

    it("código repetido: 409 en el campo `code` y no se manda correo", async () => {
      const { agent } = await createAdminSession(app);
      const customer = await seedCustomer();
      await seedCoupon({ code: "REPETIDO1" });

      const res = await agent.post(`/api/v1/admin/customers/${customer._id}/coupons`).send({ code: "repetido1", discountType: "percent", percentOff: 5 });

      expect(res.status).toBe(409);
      expect(res.body.errors.code).toBeTruthy();
      expect(mail.calls).toHaveLength(0);
    });

    it("no acepta tope de personas ni cambiar la clase", async () => {
      const { agent } = await createAdminSession(app);
      const customer = await seedCustomer();
      const res = await agent
        .post(`/api/v1/admin/customers/${customer._id}/coupons`)
        .send({ code: "PERSONAL5", discountType: "percent", percentOff: 5, maxCustomers: 500, kind: "public" });
      expect(res.status).toBe(201);
      expect(res.body.data.coupon.maxCustomers).toBe(1);
      expect(res.body.data.coupon.kind).toBe(CouponKind.PERSONAL);
    });

    it("exige admin", async () => {
      const { agent } = await createCustomerSession(app);
      const customer = await seedCustomer();
      const res = await agent.post(`/api/v1/admin/customers/${customer._id}/coupons`).send({ code: "NOADMIN1", discountType: "percent", percentOff: 5 });
      expect(res.status).toBe(403);
    });
  });
});
