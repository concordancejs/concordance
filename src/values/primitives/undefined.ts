import { type Comparison, strictlyEqual, unequal } from '../../comparison.ts'
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

export class UndefinedRepresentation implements CommonRepresentation, ShallowFunctionality {
  static is(other: ValueRepresentation): other is UndefinedRepresentation {
    return #undefined in other
  }

  readonly #undefined: undefined

  get deserialized() {
    return false
  }

  compare(other: ValueRepresentation): Comparison {
    return #undefined in other ? strictlyEqual : unequal
  }

  formatShallow(formatter: Formatter): void {
    formatter.append(formatter.wrap('undefined', 'undefined'))
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.undefined)
    return finished
  }
}

void (UndefinedRepresentation satisfies new (
  ...arguments_: ConstructorParameters<typeof UndefinedRepresentation>
) => PrimitiveRepresentation)
