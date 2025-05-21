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
} from '../../value.js'
import type { Formatter } from '../../formatter.ts'

export class StringRepresentation implements CommonRepresentation, ShallowFunctionality {
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
}

void (StringRepresentation satisfies new (
  ...arguments_: ConstructorParameters<typeof StringRepresentation>
) => PrimitiveRepresentation)
