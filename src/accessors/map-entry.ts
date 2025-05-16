import never from 'never'
import { possiblyEqual, strictlyEqual, unequal } from '../comparison.ts'
import { DeserializationContext } from '../deserialization-context.ts' // eslint-disable-line import/no-cycle
import { type SerializationResult, partial } from '../serialization-result.ts'
import type { ValueRepresentation } from '../value.js'
import type { Context } from '../context.js'

export class MapEntryAccessor implements ValueRepresentation {
  static is(value: object): value is MapEntryAccessor {
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

  serialize(): SerializationResult {
    return partial
  }
}
