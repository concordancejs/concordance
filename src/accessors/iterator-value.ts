import { unequal } from '../comparison.ts'
import { partial, type SerializationResult } from '../serialization-result.ts'
import type { Encoder } from '../encoder.ts'
import type {
  AccessorRepresentation,
  CommonRepresentation,
  DeepFunctionality,
  Opaque,
  ValueRepresentation,
} from '../value.d.ts'
import type { Formatter } from '../formatter.ts'

export class IteratorValueAccessor implements CommonRepresentation, DeepFunctionality {
  static is(value: Opaque): value is IteratorValueAccessor {
    return #value in value
  }

  readonly #index: number
  readonly #value: ValueRepresentation

  constructor(key: number, value: ValueRepresentation) {
    this.#index = key
    this.#value = value
  }

  get deserialized() {
    return this.#value.deserialized
  }

  *[Symbol.iterator]() {
    yield this.#value
  }

  compare(other: ValueRepresentation) {
    if (!(#value in other)) return unequal
    if (this.#index !== other.#index) return unequal
    return this.#value.compare(other.#value)
  }

  finalFormat(formatter: Formatter): void {
    formatter.append(formatter.theme.iteratorValue.after).close()
  }

  serialize(encoder: Encoder): SerializationResult {
    return this.#value.serializeShallow?.(encoder) ?? partial
  }
}

void (IteratorValueAccessor satisfies new (
  ...arguments_: ConstructorParameters<typeof IteratorValueAccessor>
) => AccessorRepresentation)
