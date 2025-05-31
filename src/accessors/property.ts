import never from 'never'
import {
  type Comparison,
  comparableAfterAlignment,
  comparable,
  strictlyEqual,
  unequal,
  possiblyEqual,
} from '../comparison.ts'
import { DeserializationContext } from '../deserialization-context.ts' // eslint-disable-line import/no-cycle
import type { Encoder } from '../encoder.ts'
import { partialStoreAsByteArray, type SerializationResult, partial } from '../serialization-result.ts'
import type { AccessorRepresentation, CommonRepresentation, DeepFunctionality, ValueRepresentation } from '../value.js'
import type { Context } from '../context.js'
import type { SymbolRepresentation } from '../values/primitives/symbol.ts'

export class NamedPropertyAccessor implements CommonRepresentation, DeepFunctionality {
  readonly #key: string
  readonly #value: ValueRepresentation

  constructor(key: string, value: ValueRepresentation) {
    this.#key = key
    this.#value = value
  }

  *[Symbol.iterator]() {
    yield this.#value
  }

  compare(other: ValueRepresentation): Comparison {
    if (!(#value in other)) return unequal
    if (this.#key !== other.#key) return unequal

    return this.#value.compare(other.#value)
  }

  serialize(encoder: Encoder): SerializationResult {
    encoder.string(this.#key)
    return this.#value.serializeShallow?.(encoder) ?? partial
  }
}

void (NamedPropertyAccessor satisfies new (
  ...arguments_: ConstructorParameters<typeof NamedPropertyAccessor>
) => AccessorRepresentation)

export class SymbolPropertyAccessor implements CommonRepresentation, DeepFunctionality {
  static orderByIntersection(
    lhs: SymbolPropertyAccessor[],
    rhs: SymbolPropertyAccessor[],
  ): [SymbolPropertyAccessor[], SymbolPropertyAccessor[]] {
    const lhsOrdered: SymbolPropertyAccessor[] = []
    const rhsOrdered: SymbolPropertyAccessor[] = []
    const lhsNonIntersecting: SymbolPropertyAccessor[] = []

    const rhsNonIntersecting = new Set(rhs)
    for (const lhsProperty of lhs) {
      let intersected = false
      for (const rhsProperty of rhsNonIntersecting) {
        const comparison = lhsProperty.#key.compare(rhsProperty.#key)
        if (comparison === strictlyEqual || comparison === possiblyEqual) {
          lhsOrdered.push(lhsProperty)
          rhsOrdered.push(rhsProperty)
          rhsNonIntersecting.delete(rhsProperty)
          intersected = true
          break
        }
      }

      if (!intersected) {
        lhsNonIntersecting.push(lhsProperty)
      }
    }

    return [
      [...lhsOrdered, ...lhsNonIntersecting],
      [...rhsOrdered, ...rhsNonIntersecting],
    ]
  }

  readonly #context: Context
  readonly #key: SymbolRepresentation
  #valueRepresentation?: ValueRepresentation

  constructor(context: Context, key: SymbolRepresentation, value?: ValueRepresentation) {
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
    yield this.#value
  }

  compare(other: ValueRepresentation): Comparison {
    if (!(#value in other)) return unequal
    const comparison = this.#key.compare(other.#key)
    if (comparison !== strictlyEqual && comparison !== possiblyEqual) return unequal

    return this.#value.compare(other.#value)
  }

  serialize(encoder: Encoder): SerializationResult {
    this.#key.serializeShallow(encoder)
    return partialStoreAsByteArray
  }
}

void (SymbolPropertyAccessor satisfies new (
  ...arguments_: ConstructorParameters<typeof SymbolPropertyAccessor>
) => AccessorRepresentation)

export type PropertyGroup = NamedPropertyGroup | SymbolPropertyGroup

export class NamedPropertyGroup implements CommonRepresentation {
  static is(value: object): value is NamedPropertyGroup {
    return #properties in value
  }

  readonly #context: Context
  readonly #properties: NamedPropertyAccessor[]

  constructor(context: Context, properties: NamedPropertyAccessor[]) {
    this.#context = context
    this.#properties = properties
  }

  get empty() {
    return this.#properties.length === 0
  }

  *[Symbol.iterator]() {
    yield* DeserializationContext.is(this.#context) ? this.#context.iterateNamedProperties(this) : this.#properties
  }

  compare(other: ValueRepresentation | PropertyGroup): Comparison {
    return #properties in other ? comparable : unequal
  }
}

export class SymbolPropertyGroup implements CommonRepresentation {
  static is(value: object): value is NamedPropertyGroup {
    return #properties in value
  }

  #properties: SymbolPropertyAccessor[]

  constructor(properties: SymbolPropertyAccessor[]) {
    this.#properties = properties
  }

  get empty() {
    return this.#properties.length === 0
  }

  align(other: SymbolPropertyGroup) {
    const [aligned, otherAligned] = SymbolPropertyAccessor.orderByIntersection(this.#properties, other.#properties)
    this.#properties = aligned
    other.#properties = otherAligned
  }

  compare(other: ValueRepresentation | PropertyGroup): Comparison {
    return #properties in other ? comparableAfterAlignment : unequal
  }

  *[Symbol.iterator]() {
    yield* this.#properties
  }
}
