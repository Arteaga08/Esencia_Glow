import type { Types } from "mongoose";

/** Reordena `docs` según `orderedIds`, descartando los ids que ya no resuelven. */
function inSavedOrder<T extends { _id: Types.ObjectId }>(orderedIds: Types.ObjectId[], docs: T[]): T[] {
  const byId = new Map(docs.map((doc) => [doc._id.toString(), doc]));
  return orderedIds.flatMap((id) => byId.get(id.toString()) ?? []);
}

export { inSavedOrder };
