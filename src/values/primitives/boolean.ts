import { type Comparison, strictlyEqual, unequal } from '../../comparison.ts'
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

export class BooleanRepresentation implements CommonRepresentation, ShallowFunctionality {
  static deserialize(decoder: Decoder): BooleanRepresentation {
    return new this(decoder.boolean())
  }

  readonly #value: boolean

  constructor(value: boolean) {
    this.#value = value
  }

  get deserialized() {
    return false
  }

  compare(other: ValueRepresentation): Comparison {
    return #value in other && this.#value === other.#value ? strictlyEqual : unequal
  }

  formatShallow(formatter: Formatter): void {
    formatter.append(formatter.wrap('boolean', this.#value ? 'true' : 'false'))
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.boolean).boolean(this.#value)
    return finished
  }
}

void (BooleanRepresentation satisfies new (
  ...arguments_: ConstructorParameters<typeof BooleanRepresentation>
) => PrimitiveRepresentation)
