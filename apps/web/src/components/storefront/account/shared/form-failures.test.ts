import { ErrorCode } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import type { Failure } from "@/lib/storefront/auth-errors";
import { CREDENTIALS_ERROR, mapLoginFailure, mapPasswordChangeFailure } from "./form-failures";

function failure(partial: Partial<Failure> & Pick<Failure, "kind">): Failure {
  return { message: "mensaje del API", fieldErrors: {}, ...partial };
}

describe("mapPasswordChangeFailure", () => {
  it("reconoce la contraseña actual incorrecta por código, no por texto", () => {
    const result = mapPasswordChangeFailure(failure({ kind: "unauthorized", code: ErrorCode.CURRENT_PASSWORD_INCORRECT, message: "otro texto cualquiera" }));
    expect(result.errors.current).toMatch(/contraseña actual/i);
    expect(result.formError).toBeNull();
  });

  it("un 401 sin código no se confunde con la actual mal, aunque el texto diga 'actual'", () => {
    const result = mapPasswordChangeFailure(failure({ kind: "unauthorized", message: "Sesión actual vencida" }));
    expect(result.errors.current).toBeUndefined();
    expect(result.formError).toBe("Sesión actual vencida");
  });

  it("deja el error de la contraseña nueva en su campo", () => {
    const result = mapPasswordChangeFailure(failure({ kind: "invalid", fieldErrors: { newPassword: "Falta una mayúscula" } }));
    expect(result.errors).toEqual({ next: "Falta una mayúscula" });
  });

  it("una contraseña filtrada va al campo de la nueva", () => {
    const result = mapPasswordChangeFailure(failure({ kind: "invalid", message: "Esa contraseña aparece en filtraciones conocidas." }));
    expect(result.errors.next).toMatch(/filtraciones/);
  });

  it("cualquier otro fallo va al renglón del formulario", () => {
    const result = mapPasswordChangeFailure(failure({ kind: "network", message: "Sin conexión" }));
    expect(result).toEqual({ errors: {}, formError: "Sin conexión" });
  });
});

describe("mapLoginFailure", () => {
  it("un 403 con EMAIL_NOT_VERIFIED pide verificar el correo", () => {
    expect(mapLoginFailure(failure({ kind: "forbidden", code: ErrorCode.EMAIL_NOT_VERIFIED }))).toEqual({ kind: "unverified" });
  });

  it("un 403 de origen no permitido NO se pinta como correo sin verificar", () => {
    const result = mapLoginFailure(failure({ kind: "forbidden", code: ErrorCode.ORIGIN_NOT_ALLOWED, message: "Origen no permitido" }));
    expect(result).toEqual({ kind: "message", message: "Origen no permitido" });
  });

  it("un 403 sin código tampoco", () => {
    expect(mapLoginFailure(failure({ kind: "forbidden" })).kind).toBe("message");
  });

  it("credenciales incorrectas dan un solo texto genérico", () => {
    expect(mapLoginFailure(failure({ kind: "unauthorized" }))).toEqual({ kind: "message", message: CREDENTIALS_ERROR });
    expect(mapLoginFailure(failure({ kind: "invalid" }))).toEqual({ kind: "message", message: CREDENTIALS_ERROR });
  });

  it("red y servidor conservan su mensaje", () => {
    expect(mapLoginFailure(failure({ kind: "network", message: "Sin conexión" }))).toEqual({ kind: "message", message: "Sin conexión" });
  });
});
