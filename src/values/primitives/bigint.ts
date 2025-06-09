import { strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { type ShallowSerializationResult, finished } from '../../serialization-result.ts'
import type {
  CommonRepresentation,
  PrimitiveRepresentation,
  ShallowFunctionality,
  ValueRepresentation,
} from '../../value.d.ts'
import type { Formatter } from '../../formatter.ts'

export class BigIntRepresentation implements CommonRepresentation, ShallowFunctionality {
  static deserialize(decoder: Decoder): BigIntRepresentation {
    return new this(decoder.bigInt())
  }

  readonly #value: bigint

  constructor(value: bigint) {
    this.#value = value
  }

  get deserialized() {
    return false
  }

  compare(other: ValueRepresentation) {
    return #value in other && Object.is(this.#value, other.#value) ? strictlyEqual : unequal
  }

  formatShallow(formatter: Formatter): void {
    formatter.append(formatter.wrap('bigInt', `${this.#value}n`))
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.bigint).bigInt(this.#value)
    return finished
  }
}

void (BigIntRepresentation satisfies new (
  ...arguments_: ConstructorParameters<typeof BigIntRepresentation>
) => PrimitiveRepresentation)
