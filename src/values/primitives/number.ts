import { strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { type ShallowSerializationResult, finished } from '../../serialization-result.ts'
import type { ValueRepresentation } from '../../value.js'

export class NumberRepresentation implements ValueRepresentation {
  static deserialize(decoder: Decoder): NumberRepresentation {
    return new this(decoder.number())
  }

  readonly #value: number

  constructor(value: number) {
    this.#value = value
  }

  compare(other: ValueRepresentation) {
    return #value in other && Object.is(this.#value, other.#value) ? strictlyEqual : unequal
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.number).number(this.#value)
    return finished
  }

  serialize(encoder: Encoder) {
    return this.serializeShallow(encoder)
  }
}
