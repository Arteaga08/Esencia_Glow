import { authenticator } from "otplib";
import { UserRole } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { User } from "../../src/models/user.model.js";
import { Session } from "../../src/models/session.model.js";
import { issueSession } from "../../src/services/session.service.js";
import { enableTwoFactor, setupTwoFactor } from "../../src/services/two-factor.service.js";
import { resetAdminTwoFactor } from "../../src/scripts/reset-admin-two-factor.js";

async function createEnrolledAdmin(email: string) {
  const admin = await User.create({
    email,
    password: "Contrasena1",
    firstName: "Admin",
    lastName: "Perdido",
    role: UserRole.ADMIN,
    emailVerified: true,
  });
  const setup = await setupTwoFactor(admin._id);
  await enableTwoFactor(admin._id, authenticator.generate(setup.secret));
  return admin;
}

describe("scripts/reset-admin-two-factor — rescate cuando el admin perdió el dispositivo", () => {
  it("resetea 2FA y revoca las sesiones activas de un admin existente", async () => {
    const admin = await createEnrolledAdmin("admin-perdido@esenciaglow.mx");
    const session = await issueSession(admin._id);

    const result = await resetAdminTwoFactor({ email: admin.email });

    expect(result.outcome).toBe("reset");

    const reloaded = await User.findById(admin._id).select("+twoFactor.secret");
    expect(reloaded?.twoFactor.enabled).toBe(false);
    expect(reloaded?.twoFactor.secret).toBeUndefined();

    const sessionDoc = await Session.findOne({ userId: admin._id });
    expect(sessionDoc?.revokedAt).toBeDefined();
    void session;
  });

  it("con un correo que no es admin (o no existe) -> not-found, sin tocar nada", async () => {
    await User.create({
      email: "cliente@esenciaglow.mx",
      password: "Contrasena1",
      firstName: "Cliente",
      lastName: "Glow",
      role: UserRole.CUSTOMER,
      emailVerified: true,
    });

    const result = await resetAdminTwoFactor({ email: "cliente@esenciaglow.mx" });
    expect(result.outcome).toBe("not-found");

    const noExiste = await resetAdminTwoFactor({ email: "no-existe@esenciaglow.mx" });
    expect(noExiste.outcome).toBe("not-found");
  });

  it("después del reset, el admin vuelve a pasar por el enrolamiento obligatorio en su próximo login", async () => {
    const admin = await createEnrolledAdmin("admin-recupera@esenciaglow.mx");
    await resetAdminTwoFactor({ email: admin.email });

    const { login } = await import("../../src/services/auth.service.js");
    const result = await login({ email: admin.email, password: "Contrasena1" }, {});
    expect(result.outcome).toBe("twoFactorSetupRequired");
  });
});
