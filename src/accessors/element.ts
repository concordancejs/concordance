import { deeplyEqual, strictlyEqual, unequal } from '../comparison.ts'
import type { Encoder } from '../serialize.ts'
import { staticTypeTable } from '../serialization-types.ts'
import { type SerializationResult, finished, partial } from '../serialization-result.ts'
import type { ValueRepresentation } from '../value.js'
import { UndefinedRepresentation } from '../values/primitives/undefined.ts'

export class SparseValueRepresentation implements ValueRepresentation {
  readonly #sparse: undefined

  compare(other: ValueRepresentation) {
    if (#sparse in other) return strictlyEqual
    // Allow sparse values to be equal to undefined.
    if (UndefinedRepresentation.is(other)) return deeplyEqual
    return unequal
  }

  serialize(encoder: Encoder): SerializationResult {
    encoder.staticType(staticTypeTable.undefined)
    return finished
  }
}

export class ElementAccessor implements ValueRepresentation {
  static is(value: object): value is ElementAccessor {
    return #value in value
  }

  readonly #index: number
  readonly #value: ValueRepresentation

  constructor(key: number, value: ValueRepresentation) {
    this.#index = key
    this.#value = value
  }

  *[Symbol.iterator]() {
    yield this.#value
  }

  compare(other: ValueRepresentation) {
    if (!(#value in other)) return unequal
    if (this.#index !== other.#index) return unequal
    return this.#value.compare(other.#value)
  }

  serialize(encoder: Encoder): SerializationResult {
    return this.#value.serializeShallow?.(encoder) ?? partial
  }
}
