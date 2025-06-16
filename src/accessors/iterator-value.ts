import { comparable, unequal, type Mode } from '../comparison.ts'
import { partial, type SerializationResult } from '../serialization-result.ts'
import type { Encoder } from '../encoder.ts'
import type {
  AccessorRepresentation,
  CommonRepresentation,
  DeepFunctionality,
  GroupFunctionality,
  GroupRepresentation,
  Opaque,
  ValueRepresentation,
} from '../value.d.ts'
import type { Formatter } from '../formatter.ts'
import { SetRepresentation } from '../values/objects/set.ts'
import type { TakeWhile } from '../stack.ts'
import { fullyDeserialize } from '../deserialize.ts'

export class IteratorValueAccessor implements CommonRepresentation, DeepFunctionality {
  static is(value: Opaque): value is IteratorValueAccessor {
    return #value in value
  }

  static alignForComparison(
    lhs: IteratorValueAccessor[],
    rhs: IteratorValueAccessor[],
    mode: Mode,
  ): [IteratorValueAccessor[], IteratorValueAccessor[]] {
    const lhsOrdered: IteratorValueAccessor[] = []
    const rhsOrdered: IteratorValueAccessor[] = []
    const lhsNonIntersecting: IteratorValueAccessor[] = []

    const rhsNonIntersecting = new Set(rhs)
    for (const lhsEntry of lhs) {
      let intersected = false
      for (const rhsEntry of rhsNonIntersecting) {
        if (lhsEntry.#value.compare(rhsEntry.#value, mode) !== unequal) {
          lhsOrdered.push(lhsEntry)
          rhsOrdered.push(rhsEntry)
          rhsNonIntersecting.delete(rhsEntry)
          intersected = true
          break
        }
      }

      if (!intersected) {
        lhsNonIntersecting.push(lhsEntry)
      }
    }

    return [
      mode === 'comprehensive' ? [...lhsOrdered, ...lhsNonIntersecting] : lhsOrdered,
      [...rhsOrdered, ...rhsNonIntersecting],
    ]
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

  groupForComparison(takeWhile: TakeWhile, parent: ValueRepresentation, mode: Mode) {
    if (mode === 'comprehensive' || !SetRepresentation.is(parent) || IteratorValueGroup.is(parent)) {
      return
    }

    const values: IteratorValueAccessor[] = [
      fullyDeserialize(this),
      ...takeWhile((value) => IteratorValueAccessor.is(value)),
    ]
    return new IteratorValueGroup(values)
  }

  compare(other: ValueRepresentation, mode: Mode) {
    if (!(#value in other)) return unequal
    if (mode === 'comprehensive' && this.#index !== other.#index) return unequal
    return this.#value.compare(other.#value, mode)
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

export class IteratorValueGroup implements CommonRepresentation, GroupFunctionality {
  static is(value: ValueRepresentation): value is IteratorValueGroup {
    return #values in value
  }

  #values: IteratorValueAccessor[]
  constructor(values: IteratorValueAccessor[]) {
    this.#values = values
  }

  get deserialized() {
    return this.#values[0]?.deserialized ?? false
  }

  *[Symbol.iterator]() {
    yield* this.#values
  }

  align(other: ValueRepresentation, mode: Mode): void {
    if (!IteratorValueGroup.is(other)) return

    const [aligned, otherAligned] = IteratorValueAccessor.alignForComparison(this.#values, other.#values, mode)
    this.#values = aligned
    other.#values = otherAligned
  }

  compare(other: ValueRepresentation) {
    if (!(#values in other)) return unequal
    if (this.#values.length !== other.#values.length) return unequal
    return comparable
  }
}

void (IteratorValueGroup satisfies new (
  ...arguments_: ConstructorParameters<typeof IteratorValueGroup>
) => GroupRepresentation)
