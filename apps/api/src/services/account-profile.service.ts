import type { AccountDto } from "@esencia-glow/shared";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { ACCOUNT_SELECT, buildAccountDto, type LeanAccountUser } from "./account-dto.js";

/**
 * Lectura del DTO único de "Mi Cuenta" y edición del perfil. Todo cuelga del
 * `userId` de la sesión (recurso self-scoped: ninguna ruta lleva id de dueño).
 */

interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  birthDate?: Date | null;
  city?: string | null;
}

async function getAccount(userId: string): Promise<AccountDto> {
  const user = await User.findById(userId).select(ACCOUNT_SELECT).lean<LeanAccountUser>();
  if (!user) throw new AppError("No autenticado", 401);
  return buildAccountDto(user);
}

/** `null` borra un opcional (`$unset`); un campo ausente no se toca. */
async function updateProfile(userId: string, input: UpdateProfileInput): Promise<AccountDto> {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (value === null) $unset[key] = 1;
    else $set[key] = value;
  }

  const update = {
    ...(Object.keys($set).length > 0 ? { $set } : {}),
    ...(Object.keys($unset).length > 0 ? { $unset } : {}),
  };
  const result = await User.updateOne({ _id: userId }, update, { runValidators: true });
  if (result.matchedCount === 0) throw new AppError("No autenticado", 401);

  return getAccount(userId);
}

export { getAccount, updateProfile };
export type { UpdateProfileInput };
