import { authenticator } from "otplib";
import { UserRole } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { User } from "../../src/models/user.model.js";
import { Session } from "../../src/models/session.model.js";
import { issueSession } from "../../src/services/session.service.js";
import { enableTwoFactor, setupTwoFactor } from "../../src/services/two-factor.service.js";
import { revokeAdminsWithoutTwoFactor } from "../../src/scripts/revoke-admins-without-2fa.js";

async function createAdmin(email: string) {
  return User.create({
    email,
    password: "Contrasena1",
    firstName: "Admin",
    lastName: "Glow",
    role: UserRole.ADMIN,
    emailVerified: true,
  });
}

describe("scripts/revoke-admins-without-2fa — paso de despliegue del enrolamiento obligatorio", () => {
  it("revoca las sesiones de admins sin 2FA y deja intactas las de admins con 2FA", async () => {
    const withoutTwoFactor = await createAdmin("sin-2fa@esenciaglow.mx");
    const sessionWithout = await issueSession(withoutTwoFactor._id);

    const withTwoFactor = await createAdmin("con-2fa@esenciaglow.mx");
    const setup = await setupTwoFactor(withTwoFactor._id);
    await enableTwoFactor(withTwoFactor._id, authenticator.generate(setup.secret));
    const sessionWith = await issueSession(withTwoFactor._id);

    const result = await revokeAdminsWithoutTwoFactor();
    expect(result.revokedCount).toBe(1);

    const revokedSession = await Session.findOne({ userId: withoutTwoFactor._id });
    expect(revokedSession?.revokedAt).toBeDefined();

    const untouchedSession = await Session.findOne({ userId: withTwoFactor._id });
    expect(untouchedSession?.revokedAt).toBeUndefined();

    void sessionWithout;
    void sessionWith;
  });

  it("sin admins sin 2FA -> revokedCount 0, sin tocar nada", async () => {
    const withTwoFactor = await createAdmin("solo-con-2fa@esenciaglow.mx");
    const setup = await setupTwoFactor(withTwoFactor._id);
    await enableTwoFactor(withTwoFactor._id, authenticator.generate(setup.secret));

    const result = await revokeAdminsWithoutTwoFactor();
    expect(result.revokedCount).toBe(0);
  });
});
