import never from 'never'
import { comparable, possiblyEqual, strictlyEqual, unequal, type Comparison, type Mode } from '../comparison.ts'
import { DeserializationContext } from '../deserialization-context.ts'
import { type SerializationResult, partial } from '../serialization-result.ts'
import type {
  AccessorRepresentation,
  CommonRepresentation,
  DeepFunctionality,
  GroupFunctionality,
  GroupRepresentation,
  ValueRepresentation,
} from '../value.d.ts'
import type { Context } from '../context.d.ts'
import type { Formatter } from '../formatter.ts'
import type { TakeWhile } from '../stack.ts'
import { fullyDeserialize } from '../deserialize.ts'

export class MapEntryAccessor implements CommonRepresentation, DeepFunctionality {
  static is(value: ValueRepresentation): value is MapEntryAccessor {
    return #value in value
  }

  static alignForComparison(
    lhs: MapEntryAccessor[],
    rhs: MapEntryAccessor[],
    mode: Mode,
  ): [MapEntryAccessor[], MapEntryAccessor[]] {
    const lhsOrdered: MapEntryAccessor[] = []
    const rhsOrdered: MapEntryAccessor[] = []
    const lhsNonIntersecting: MapEntryAccessor[] = []

    const rhsNonIntersecting = new Set(rhs)
    for (const lhsEntry of lhs) {
      let intersected = false
      for (const rhsEntry of rhsNonIntersecting) {
        if (lhsEntry.#key.compare(rhsEntry.#key, mode) !== unequal) {
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

  readonly #context: Context
  readonly #key: ValueRepresentation
  #valueRepresentation?: ValueRepresentation

  constructor(context: Context, key: ValueRepresentation, value?: ValueRepresentation) {
    this.#context = context
    this.#key = key
    this.#valueRepresentation = value
  }

  get deserialized() {
    return this.#context.deserialized
  }

  get #value() {
    if (!this.#valueRepresentation && DeserializationContext.is(this.#context)) {
      this.#valueRepresentation = this.#context.next() ?? never()
    }

    return this.#valueRepresentation ?? never()
  }

  *[Symbol.iterator]() {
    yield this.#key
    yield this.#value
  }

  groupForComparison(takeWhile: TakeWhile, parent: ValueRepresentation, mode: Mode) {
    if (mode === 'comprehensive' || MapEntryGroup.is(parent)) {
      return
    }

    const entries: MapEntryAccessor[] = [fullyDeserialize(this), ...takeWhile((value) => MapEntryAccessor.is(value))]
    return new MapEntryGroup(entries)
  }

  acceptsComparisonFrom(other: ValueRepresentation): boolean {
    return #value in other
  }

  compare(other: ValueRepresentation, mode: Mode) {
    if (!(#value in other)) return unequal

    const keyComparison = this.#key.compare(other.#key, mode)
    if (keyComparison !== strictlyEqual && keyComparison !== possiblyEqual) return keyComparison

    return this.#value.compare(other.#value, mode)
  }

  formatAfterIteration(formatter: Formatter, value: ValueRepresentation): void {
    if (value === this.#key) {
      formatter.append(formatter.theme.mapEntry.afterKey)
    }
  }

  finalFormat(formatter: Formatter): void {
    formatter.append(formatter.theme.mapEntry.afterValue).close()
  }

  serialize(): SerializationResult {
    return partial
  }
}

void (MapEntryAccessor satisfies new (
  ...arguments_: ConstructorParameters<typeof MapEntryAccessor>
) => AccessorRepresentation)

export class MapEntryGroup implements CommonRepresentation, GroupFunctionality {
  static is(value: ValueRepresentation): value is MapEntryGroup {
    return #entries in value
  }

  #entries: MapEntryAccessor[]

  constructor(entries: MapEntryAccessor[]) {
    this.#entries = entries
  }

  get deserialized() {
    return this.#entries[0]?.deserialized ?? false
  }

  *[Symbol.iterator]() {
    yield* this.#entries
  }

  align(other: ValueRepresentation, mode: Mode): void {
    if (!MapEntryGroup.is(other)) {
      return
    }

    const [aligned, otherAligned] = MapEntryAccessor.alignForComparison(this.#entries, other.#entries, mode)
    this.#entries = aligned
    other.#entries = otherAligned
  }

  acceptsComparisonFrom(other: ValueRepresentation) {
    return #entries in other
  }

  compare(other: ValueRepresentation): Comparison {
    if (!(#entries in other)) return unequal
    if (this.#entries.length !== other.#entries.length) return unequal
    return comparable
  }
}

void (MapEntryGroup satisfies new (...arguments_: ConstructorParameters<typeof MapEntryGroup>) => GroupRepresentation)
