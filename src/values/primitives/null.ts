import { strictlyEqual, unequal } from '../../comparison.ts'
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

export class NullRepresentation implements CommonRepresentation, ShallowFunctionality {
  readonly #null: undefined

  get deserialized() {
    return false
  }

  compare(other: ValueRepresentation) {
    return #null in other ? strictlyEqual : unequal
  }

  formatShallow(formatter: Formatter): void {
    formatter.append(formatter.wrap('null', 'null'))
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.null)
    return finished
  }
}

void (NullRepresentation satisfies new (
  ...arguments_: ConstructorParameters<typeof NullRepresentation>
) => PrimitiveRepresentation)
