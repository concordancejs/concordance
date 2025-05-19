import { type Comparison, strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { type ShallowSerializationResult, finished } from '../../serialization-result.ts'
import type { ValueRepresentation } from '../../value.js'

export class StringRepresentation implements ValueRepresentation {
  static deserialize(decoder: Decoder): StringRepresentation {
    return new this(decoder.string())
  }

  readonly #value: string

  constructor(value: string) {
    this.#value = value
  }

  compare(other: ValueRepresentation): Comparison {
    return #value in other && this.#value === other.#value ? strictlyEqual : unequal
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.string).string(this.#value)
    return finished
  }

  serialize(encoder: Encoder) {
    return this.serializeShallow(encoder)
  }
}
