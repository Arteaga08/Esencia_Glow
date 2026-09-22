import { UserRole } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { User } from "../../src/models/user.model.js";
import { seedAdmin } from "../../src/scripts/seed-admin.js";

describe("scripts/seed-admin", () => {
  it("sin admin previo -> lo crea", async () => {
    const email = "nuevo-admin@esenciaglow.mx";

    const result = await seedAdmin({
      email,
      password: "contraseña-temporal-1",
      allowOverwriteExisting: false,
    });

    expect(result.outcome).toBe("created");
    const created = await User.findOne({ email });
    expect(created?.role).toBe(UserRole.ADMIN);
    expect(created?.emailVerified).toBe(true);
  });

  it("con admin previo y allowOverwriteExisting=true -> resetea la contraseña", async () => {
    const email = "admin-existente@esenciaglow.mx";
    await User.create({
      email,
      password: "contraseña-vieja-123",
      firstName: "Admin",
      lastName: "Viejo",
      role: UserRole.ADMIN,
      emailVerified: false,
    });

    const result = await seedAdmin({
      email,
      password: "contraseña-nueva-456",
      allowOverwriteExisting: true,
    });

    expect(result.outcome).toBe("updated");
    const updated = await User.findOne({ email }).select("+password");
    expect(updated?.emailVerified).toBe(true);
    expect(await updated?.comparePassword("contraseña-nueva-456")).toBe(true);
  });

  it("con admin previo y allowOverwriteExisting=false -> se rehúsa sin tocarlo (caso de producción)", async () => {
    const email = "admin-real-de-produccion@esenciaglow.mx";
    await User.create({
      email,
      password: "contraseña-real-de-produccion",
      firstName: "Admin",
      lastName: "Real",
      role: UserRole.ADMIN,
      emailVerified: true,
    });

    await expect(
      seedAdmin({
        email,
        password: "contraseña-que-un-intruso-quisiera-poner",
        allowOverwriteExisting: false,
      }),
    ).rejects.toThrow(/no lo toca/);

    const untouched = await User.findOne({ email }).select("+password");
    expect(await untouched?.comparePassword("contraseña-real-de-produccion")).toBe(true);
  });
});
