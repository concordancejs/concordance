import { deeplyEqual, strictlyEqual, unequal } from '../comparison.ts'
import type { Encoder } from '../encoder.ts'
import { staticTypeTable } from '../serialization-types.ts'
import {
  type SerializationResult,
  type ShallowSerializationResult,
  finished,
  partial,
} from '../serialization-result.ts'
import type {
  AccessorRepresentation,
  CommonRepresentation,
  DeepFunctionality,
  PrimitiveRepresentation,
  ShallowFunctionality,
  ValueRepresentation,
} from '../value.js'
import { UndefinedRepresentation } from '../values/primitives/undefined.ts'
import type { Formatter } from '../formatter.ts'

export class SparseValueRepresentation implements CommonRepresentation, ShallowFunctionality {
  readonly #sparse: undefined

  compare(other: ValueRepresentation) {
    if (#sparse in other) return strictlyEqual
    // Allow sparse values to be equal to undefined.
    if (UndefinedRepresentation.is(other)) return deeplyEqual
    return unequal
  }

  formatShallow(formatter: Formatter): void {
    formatter.append(formatter.theme.array.sparse)
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.undefined)
    return finished
  }
}

void (SparseValueRepresentation satisfies new (
  ...arguments_: ConstructorParameters<typeof SparseValueRepresentation>
) => PrimitiveRepresentation)

export class ElementAccessor implements CommonRepresentation, DeepFunctionality {
  static is(value: object): value is ElementAccessor {
    return #value in value
  }

  readonly #index: number
  readonly #value: ValueRepresentation

  constructor(key: number, value: ValueRepresentation) {
    this.#index = key
    this.#value = value
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
    formatter.append(formatter.theme.element.after).close()
  }

  serialize(encoder: Encoder): SerializationResult {
    return this.#value.serializeShallow?.(encoder) ?? partial
  }
}

void (ElementAccessor satisfies new (
  ...arguments_: ConstructorParameters<typeof ElementAccessor>
) => AccessorRepresentation)
