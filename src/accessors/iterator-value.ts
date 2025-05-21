import { unequal } from '../comparison.ts'
import { partial, type SerializationResult } from '../serialization-result.ts'
import type { Encoder } from '../encoder.ts'
import type { AccessorRepresentation, CommonRepresentation, DeepFunctionality, ValueRepresentation } from '../value.js'

export class IteratorValueAccessor implements CommonRepresentation, DeepFunctionality {
  static is(value: object): value is IteratorValueAccessor {
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

void (IteratorValueAccessor satisfies new (
  ...arguments_: ConstructorParameters<typeof IteratorValueAccessor>
) => AccessorRepresentation)
