import never from 'never'
import { possiblyEqual, strictlyEqual, unequal } from '../comparison.ts'
import { DeserializationContext } from '../deserialization-context.ts'
import { type SerializationResult, partial } from '../serialization-result.ts'
import type {
  AccessorRepresentation,
  CommonRepresentation,
  DeepFunctionality,
  Opaque,
  ValueRepresentation,
} from '../value.d.ts'
import type { Context } from '../context.d.ts'
import type { Formatter } from '../formatter.ts'

export class MapEntryAccessor implements CommonRepresentation, DeepFunctionality {
  static is(value: Opaque): value is MapEntryAccessor {
    return #value in value
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

  compare(other: ValueRepresentation) {
    if (!(#value in other)) return unequal

    const keyComparison = this.#key.compare(other.#key)
    if (keyComparison !== strictlyEqual && keyComparison !== possiblyEqual) return keyComparison

    return this.#value.compare(other.#value)
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
