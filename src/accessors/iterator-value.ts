import { unequal } from '../comparison.ts'
import { partial, type SerializationResult } from '../serialization-result.ts'
import type { Encoder } from '../serialize.ts'
import type { ValueRepresentation } from '../value.js'

export class IteratorValueAccessor implements ValueRepresentation {
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
