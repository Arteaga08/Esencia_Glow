import { describe, expect, it } from "vitest";
import { sendPasswordChangedNotice, sendPasswordResetEmail, sendVerificationEmail } from "../../src/services/email.service.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { buildFakeMailProvider } from "../helpers/fake-mail-provider.js";

/**
 * `email.service.ts` (auth) migrado al shell compartido + `MailProvider`
 * (§8 del plan de 1.6.3) — mismo copy y las mismas firmas exportadas que
 * antes (los spies de `auth.routes.test.ts` siguen funcionando sin tocar
 * ese archivo), ahora componiendo `renderTransactionalEmail`.
 */
describe("services/email.service (auth)", () => {
  it("sendVerificationEmail: usa el shell (sin <style>) y la URL de verificación", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    await sendVerificationEmail("ana@example.com", "tok123");

    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0]!;
    expect(call.to).toBe("ana@example.com");
    expect(call.subject).toContain("Confirma tu correo");
    expect(call.html).not.toContain("<style");
    expect(call.html).toContain("<table");
    expect(call.html).toContain("verificar-correo?token=tok123");
  });

  it("sendPasswordResetEmail: URL de reset y asunto correctos", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    await sendPasswordResetEmail("ana@example.com", "reset-tok");

    const call = fake.calls[0]!;
    expect(call.subject).toContain("Restablece tu contraseña");
    expect(call.html).toContain("restablecer-contrasena?token=reset-tok");
  });

  it("sendPasswordChangedNotice: sin URL, solo aviso", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);

    await sendPasswordChangedNotice("ana@example.com");

    const call = fake.calls[0]!;
    expect(call.subject).toContain("contraseña cambió");
    expect(call.html).toContain("<table");
  });

  it("un proveedor caído no lanza — el flujo de negocio no debe verse afectado", async () => {
    __setMailProviderForTests({ send: async () => ({ sent: false }) });

    await expect(sendVerificationEmail("ana@example.com", "tok")).resolves.toBeUndefined();
  });
});
