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

export class NumberRepresentation implements CommonRepresentation, ShallowFunctionality {
  static deserialize(decoder: Decoder): NumberRepresentation {
    return new this(decoder.number())
  }

  readonly #value: number

  constructor(value: number) {
    this.#value = value
  }

  get deserialized() {
    return false
  }

  compare(other: ValueRepresentation) {
    return #value in other && Object.is(this.#value, other.#value) ? strictlyEqual : unequal
  }

  formatShallow(formatter: Formatter): void {
    formatter.append(formatter.wrap('number', `${Object.is(this.#value, -0) ? '-0' : this.#value}`))
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.number).number(this.#value)
    return finished
  }
}

void (NumberRepresentation satisfies new (
  ...arguments_: ConstructorParameters<typeof NumberRepresentation>
) => PrimitiveRepresentation)
