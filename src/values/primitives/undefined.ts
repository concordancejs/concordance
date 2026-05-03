import { type Comparison, type Condition, type Mode, strictlyEqual, unequal } from '../../comparison.ts'
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
  readonly #undefined: undefined

  get deserialized() {
    return false
  }

  acceptsComparisonFrom(other: ValueRepresentation, _mode: Mode, condition?: Condition) {
    return condition === 'from-sparse' || #undefined in other
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
