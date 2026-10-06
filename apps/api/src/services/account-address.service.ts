import { Types } from "mongoose";
import { MAX_ADDRESSES, type SavedAddress } from "@esencia-glow/shared";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { buildSavedAddress, type LeanAccountUser } from "./account-dto.js";

/**
 * Libreta de direcciones (máx. 5, a lo más una principal). Cada operación es UNA
 * escritura atómica sobre el documento de la clienta (update con pipeline), no
 * "leer, mutar y guardar": así dos altas simultáneas no pasan del tope y la
 * invariante de principal no depende de que el cliente mande bien el flag.
 *
 * El filtro de propiedad vive en la query (`_id` de la sesión + `addresses._id`):
 * una dirección ajena o inexistente es 404, nunca 403.
 */

type AddressInput = Omit<SavedAddress, "id" | "isDefault">;
type AddressPatch = Partial<Record<keyof AddressInput, string | null>>;

const NOT_FOUND = "Dirección no encontrada";
const OPTIONAL_FIELDS = new Set(["interiorNumber", "references"]);

const addressesOf = { $ifNull: ["$addresses", []] };

async function readAddress(userId: string, addressId: string): Promise<SavedAddress> {
  const user = await User.findById(userId).select("addresses").lean<Pick<LeanAccountUser, "addresses">>();
  const found = user?.addresses?.find((address) => address._id.toString() === addressId);
  if (!found) throw new AppError(NOT_FOUND, 404);
  return buildSavedAddress(found);
}

/** La primera dirección queda principal; las siguientes no (se decide dentro de la misma escritura). */
async function addAddress(userId: string, input: AddressInput): Promise<SavedAddress> {
  const id = new Types.ObjectId();
  const document = { ...input, _id: id };

  const result = await User.updateOne({ _id: userId, [`addresses.${MAX_ADDRESSES - 1}`]: { $exists: false } }, [
    {
      $set: {
        addresses: {
          $concatArrays: [
            addressesOf,
            [{ $mergeObjects: [{ $literal: document }, { isDefault: { $eq: [{ $size: addressesOf }, 0] } }] }],
          ],
        },
      },
    },
  ]);
  if (result.matchedCount === 0) {
    throw new AppError(`Puedes guardar hasta ${MAX_ADDRESSES} direcciones. Elimina una para agregar otra.`, 409);
  }

  return readAddress(userId, id.toString());
}

async function updateAddress(userId: string, addressId: string, patch: AddressPatch): Promise<SavedAddress> {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const path = `addresses.$.${key}`;
    if (value === null && OPTIONAL_FIELDS.has(key)) $unset[path] = 1;
    else $set[path] = value;
  }

  const update = {
    ...(Object.keys($set).length > 0 ? { $set } : {}),
    ...(Object.keys($unset).length > 0 ? { $unset } : {}),
  };
  const result = await User.updateOne({ _id: userId, "addresses._id": addressId }, update, { runValidators: true });
  if (result.matchedCount === 0) throw new AppError(NOT_FOUND, 404);

  return readAddress(userId, addressId);
}

async function setDefaultAddress(userId: string, addressId: string): Promise<SavedAddress> {
  const id = new Types.ObjectId(addressId);
  const result = await User.updateOne({ _id: userId, "addresses._id": id }, [
    {
      $set: {
        addresses: {
          $map: {
            input: "$addresses",
            in: { $mergeObjects: ["$$this", { isDefault: { $eq: ["$$this._id", id] } }] },
          },
        },
      },
    },
  ]);
  if (result.matchedCount === 0) throw new AppError(NOT_FOUND, 404);

  return readAddress(userId, addressId);
}

/** Si la borrada era la principal y quedan otras, la primera restante se promueve. */
async function deleteAddress(userId: string, addressId: string): Promise<void> {
  const id = new Types.ObjectId(addressId);
  const result = await User.updateOne({ _id: userId, "addresses._id": id }, [
    {
      $set: {
        addresses: {
          $let: {
            vars: {
              remaining: { $filter: { input: "$addresses", cond: { $ne: ["$$this._id", id] } } },
              removedWasDefault: {
                $anyElementTrue: [
                  { $map: { input: "$addresses", in: { $and: [{ $eq: ["$$this._id", id] }, "$$this.isDefault"] } } },
                ],
              },
            },
            in: {
              $cond: [
                { $and: ["$$removedWasDefault", { $gt: [{ $size: "$$remaining" }, 0] }] },
                {
                  $concatArrays: [
                    [{ $mergeObjects: [{ $first: "$$remaining" }, { isDefault: true }] }],
                    { $slice: ["$$remaining", 1, { $size: "$$remaining" }] },
                  ],
                },
                "$$remaining",
              ],
            },
          },
        },
      },
    },
  ]);
  if (result.matchedCount === 0) throw new AppError(NOT_FOUND, 404);
}

export { addAddress, updateAddress, setDefaultAddress, deleteAddress };
export type { AddressInput, AddressPatch };
