import { deeplyEqual, strictlyEqual, unequal, comparable, type Mode, type Comparison } from '../comparison.ts'
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
  GroupFunctionality,
  Opaque,
  PrimitiveRepresentation,
  ShallowFunctionality,
  ValueRepresentation,
  GroupRepresentation,
  AccessorFunctionality,
} from '../value.d.ts'
import { UndefinedRepresentation } from '../values/primitives/undefined.ts'
import type { Formatter } from '../formatter.ts'
import type { TakeWhile } from '../stack.ts'
import { fullyDeserialize } from '../deserialize.ts'

export class SparseValueRepresentation implements CommonRepresentation, ShallowFunctionality {
  readonly #sparse: undefined

  get deserialized() {
    return false
  }

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

export class ElementAccessor implements CommonRepresentation, DeepFunctionality, AccessorFunctionality {
  static is(value: Opaque): value is ElementAccessor {
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

  groupForComparison(takeWhile: TakeWhile, parent: ValueRepresentation, mode: Mode): ElementGroup | undefined {
    if (mode === 'comprehensive' || ElementGroup.is(parent)) {
      return
    }

    const elements: ElementAccessor[] = [fullyDeserialize(this), ...takeWhile((value) => ElementAccessor.is(value))]
    return new ElementGroup(elements)
  }

  compare(other: ValueRepresentation, mode: Mode) {
    if (!(#value in other)) return unequal
    if (this.#index !== other.#index) return unequal
    return this.#value.compare(other.#value, mode)
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

export class ElementGroup implements CommonRepresentation, GroupFunctionality {
  static is(value: ValueRepresentation): value is ElementGroup {
    return #elements in value
  }

  #elements: ElementAccessor[]

  constructor(elements: ElementAccessor[]) {
    this.#elements = elements
  }

  get deserialized() {
    return this.#elements[0]?.deserialized ?? false
  }

  *[Symbol.iterator]() {
    yield* this.#elements
  }

  align(other: ValueRepresentation, mode: Mode): void {
    if (mode === 'comprehensive' || !ElementGroup.is(other)) return

    // In fuzzy mode, drop elements from lhs so that lhs.length <= rhs.length
    if (this.#elements.length > other.#elements.length) {
      this.#elements = this.#elements.slice(0, other.#elements.length)
    }
  }

  compare(other: ValueRepresentation): Comparison {
    if (!(#elements in other)) return unequal

    return this.#elements.length === other.#elements.length ? comparable : unequal
  }
}

void (ElementGroup satisfies new (...arguments_: ConstructorParameters<typeof ElementGroup>) => GroupRepresentation)
