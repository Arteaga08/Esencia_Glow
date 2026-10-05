/**
 * Regla de contraseña de los clientes: la MISMA que valida el backend
 * (`auth.validator.ts`): 10 a 72 caracteres, con mayúscula, minúscula y
 * número. Decisión de Manuel (2026-10-05): si el backend pide 10, el front
 * pide 10. Los errores dicen qué falta, nunca solo "contraseña inválida".
 */
interface PasswordRule {
  key: string;
  label: string;
  met: (value: string) => boolean;
}

const MIN_LENGTH = 10;
// Límite real de bcrypt: más allá de 72 bytes el hash ignora el resto.
const MAX_LENGTH = 72;

const PASSWORD_RULES: PasswordRule[] = [
  { key: "length", label: "Entre 10 y 72 caracteres", met: (value) => value.length >= MIN_LENGTH && value.length <= MAX_LENGTH },
  { key: "upper", label: "Una letra mayúscula", met: (value) => /[A-Z]/.test(value) },
  { key: "lower", label: "Una letra minúscula", met: (value) => /[a-z]/.test(value) },
  { key: "digit", label: "Un número", met: (value) => /\d/.test(value) },
];

const MISSING_PHRASES: Record<string, string> = {
  length: "al menos 10 caracteres",
  upper: "una mayúscula",
  lower: "una minúscula",
  digit: "un número",
};

/** "Te falta una mayúscula y un número." o `undefined` si cumple todo. */
function describeMissing(value: string): string | undefined {
  if (value.length === 0) return "Escribe una contraseña.";
  if (value.length > MAX_LENGTH) return "La contraseña no puede pasar de 72 caracteres.";
  const missing = PASSWORD_RULES.filter((rule) => !rule.met(value)).map((rule) => MISSING_PHRASES[rule.key]!);
  if (missing.length === 0) return undefined;
  const joined = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} y ${missing[missing.length - 1]}`;
  return `Te falta ${joined}.`;
}

const STRENGTH_LABELS = ["", "Débil", "Regular", "Buena", "Fuerte"] as const;

/** 0 a 4: cuántas reglas cumple. Alimenta el medidor visual. */
function strengthScore(value: string): number {
  if (value.length === 0) return 0;
  return PASSWORD_RULES.filter((rule) => rule.met(value)).length;
}

export { PASSWORD_RULES, STRENGTH_LABELS, MAX_LENGTH, describeMissing, strengthScore };
