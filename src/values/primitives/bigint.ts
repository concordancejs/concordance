import { strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { type ShallowSerializationResult, finished } from '../../serialization-result.ts'
import type { ValueRepresentation } from '../../value.d.ts'

export class BigIntRepresentation implements ValueRepresentation {
  static deserialize(decoder: Decoder): BigIntRepresentation {
    return new this(decoder.bigInt())
  }

  readonly #value: bigint

  constructor(value: bigint) {
    this.#value = value
  }

  compare(other: ValueRepresentation) {
    return #value in other && Object.is(this.#value, other.#value) ? strictlyEqual : unequal
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.bigint).bigInt(this.#value)
    return finished
  }

  serialize(encoder: Encoder) {
    return this.serializeShallow(encoder)
  }
}
