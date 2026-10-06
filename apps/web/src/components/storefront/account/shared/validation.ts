/** Validaciones de campo de las pantallas de acceso. Cada mensaje dice qué falta y cómo arreglarlo. */

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (email.length === 0) return "Falta tu correo.";
  if (!email.includes("@")) return "Al correo le falta la @, por ejemplo maria.lopez@correo.mx.";
  if (!EMAIL_SHAPE.test(email)) return "Al correo le falta el dominio, por ejemplo maria.lopez@correo.mx.";
  return undefined;
}

function validateName(value: string, missing: string): string | undefined {
  const name = value.trim();
  if (name.length === 0) return missing;
  if (name.length < 2) return "Escribe al menos 2 letras.";
  return undefined;
}

/** Quita las claves sin error para que `Object.keys(errors).length` cuente solo fallos reales. */
function compact(errors: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1])));
}

export { validateEmail, validateName, compact };
