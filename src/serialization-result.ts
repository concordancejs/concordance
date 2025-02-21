export const finished = 1
export const partial = 2
export const partialRequiringTerminator = 3
export const partialStoreAsByteArray = 4
export type ShallowSerializationResult = typeof finished
export type SerializationResult =
  | ShallowSerializationResult
  | typeof partial
  | typeof partialRequiringTerminator
  | typeof partialStoreAsByteArray
