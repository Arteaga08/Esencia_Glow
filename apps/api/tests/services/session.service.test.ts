import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Session } from "../../src/models/session.model.js";
import { User } from "../../src/models/user.model.js";
import {
  issueSession,
  revokeAllForUser,
  rotateSession,
} from "../../src/services/session.service.js";

async function createUser() {
  return User.create({
    email: `user-${new Types.ObjectId().toHexString()}@example.com`,
    password: "Contrasena1",
    firstName: "Ana",
    lastName: "Pérez",
  });
}

describe("services/session — rotación atómica y detección de reuso", () => {
  it("emite una sesión y la rotación devuelve un token nuevo distinto", async () => {
    const user = await createUser();
    const issued = await issueSession(user._id);
    const rotated = await rotateSession(issued.rawToken);
    expect(rotated.rawToken).not.toBe(issued.rawToken);
  });

  it("dos rotaciones concurrentes con el mismo token: exactamente una gana", async () => {
    const user = await createUser();
    const issued = await issueSession(user._id);

    const results = await Promise.allSettled([
      rotateSession(issued.rawToken),
      rotateSession(issued.rawToken),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it("reusar un refresh token ya rotado revoca toda la familia (el nuevo token también deja de servir)", async () => {
    const user = await createUser();
    const issued = await issueSession(user._id);
    const rotated = await rotateSession(issued.rawToken);

    // El token viejo ya fue rotado — reusarlo es la señal de robo.
    await expect(rotateSession(issued.rawToken)).rejects.toThrow();

    // El token nuevo, emitido legítimamente en la rotación anterior, también
    // debe quedar inservible porque toda la familia se revocó.
    await expect(rotateSession(rotated.rawToken)).rejects.toThrow();
  });

  it("un token que nunca existió es rechazado sin tocar ninguna familia", async () => {
    await expect(rotateSession("token-que-nunca-existio")).rejects.toThrow();
  });

  it("revokeAllForUser invalida todas las sesiones vivas y sube sessionVersion", async () => {
    const user = await createUser();
    const a = await issueSession(user._id);
    const b = await issueSession(user._id);

    await revokeAllForUser(user._id);

    await expect(rotateSession(a.rawToken)).rejects.toThrow();
    await expect(rotateSession(b.rawToken)).rejects.toThrow();

    const reloaded = await User.findById(user._id);
    expect(reloaded?.sessionVersion).toBe(1);
  });

  it("las sesiones revocadas quedan marcadas, no se borran (auditable)", async () => {
    const user = await createUser();
    const issued = await issueSession(user._id);
    await rotateSession(issued.rawToken);

    const count = await Session.countDocuments({ userId: user._id });
    expect(count).toBe(2); // la vieja (revocada) + la nueva
  });
});
