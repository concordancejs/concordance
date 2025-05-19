import { type Comparison, strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { type ShallowSerializationResult, finished } from '../../serialization-result.ts'
import type { ValueRepresentation } from '../../value.js'

export class BooleanRepresentation implements ValueRepresentation {
  static deserialize(decoder: Decoder): BooleanRepresentation {
    return new this(decoder.boolean())
  }

  readonly #value: boolean

  constructor(value: boolean) {
    this.#value = value
  }

  compare(other: ValueRepresentation): Comparison {
    return #value in other && this.#value === other.#value ? strictlyEqual : unequal
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.boolean).boolean(this.#value)
    return finished
  }

  serialize(encoder: Encoder) {
    return this.serializeShallow(encoder)
  }
}
