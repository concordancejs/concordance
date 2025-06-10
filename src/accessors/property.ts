import {
  type Comparison,
  comparableAfterAlignment,
  comparable,
  strictlyEqual,
  unequal,
  possiblyEqual,
} from '../comparison.ts'
import { DeserializationContext } from '../deserialization-context.ts'
import type { Encoder } from '../encoder.ts'
import { type SerializationResult, partial } from '../serialization-result.ts'
import type {
  AccessorRepresentation,
  CommonRepresentation,
  DeepFunctionality,
  Opaque,
  ValueRepresentation,
} from '../value.d.ts'
import type { Context } from '../context.d.ts'
import type { SymbolRepresentation } from '../values/primitives/symbol.ts'
import type { Formatter } from '../formatter.ts'

export class NamedPropertyAccessor implements CommonRepresentation, DeepFunctionality {
  readonly #key: string
  readonly #value: ValueRepresentation

  constructor(key: string, value: ValueRepresentation) {
    this.#key = key
    this.#value = value
  }

  get deserialized() {
    return this.#value.deserialized
  }

  *[Symbol.iterator]() {
    yield this.#value
  }

  compare(other: ValueRepresentation): Comparison {
    if (!(#value in other)) return unequal
    if (this.#key !== other.#key) return unequal

    return this.#value.compare(other.#value)
  }

  preformat(formatter: Formatter) {
    // Format the key as an identifier if it matches the identifier pattern, or is an integer.
    if (/^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u.test(this.#key) || /^\d+$/.test(this.#key)) {
      formatter.append(this.#key)
    } else {
      // Otherwise, use string formatting for non-identifier keys
      formatter.append(formatter.theme.property.keyBracket.open)
      formatter.appendWrapped('string.line', formatter.encodeTypicalSimpleString(this.#key))
      formatter.append(formatter.theme.property.keyBracket.close)
    }

    formatter.append(formatter.theme.property.afterKey)
  }

  finalFormat(formatter: Formatter) {
    formatter.append(formatter.theme.property.afterValue)
    formatter.close()
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

  readonly #key: SymbolRepresentation
  readonly #value: ValueRepresentation

  constructor(key: SymbolRepresentation, value: ValueRepresentation) {
    this.#key = key
    this.#value = value
  }

  get deserialized() {
    return this.#value.deserialized
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

  preformat(formatter: Formatter) {
    formatter.append(formatter.theme.property.keyBracket.open)
    this.#key.formatShallow(formatter)
    formatter.append(formatter.theme.property.keyBracket.close, formatter.theme.property.afterKey)
  }

  finalFormat(formatter: Formatter) {
    formatter.append(formatter.theme.property.afterValue)
    formatter.close()
  }

  serialize(encoder: Encoder): SerializationResult {
    this.#key.serializeShallow(encoder)
    return partial
  }
}

void (SymbolPropertyAccessor satisfies new (
  ...arguments_: ConstructorParameters<typeof SymbolPropertyAccessor>
) => AccessorRepresentation)

export type PropertyGroup = NamedPropertyGroup | SymbolPropertyGroup

export class NamedPropertyGroup implements CommonRepresentation {
  static is(value: Opaque): value is NamedPropertyGroup {
    return #properties in value
  }

  readonly #context: Context
  readonly #properties: NamedPropertyAccessor[]

  constructor(context: Context, properties: NamedPropertyAccessor[]) {
    this.#context = context
    this.#properties = properties
  }

  get deserialized() {
    return this.#context.deserialized
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
  static is(value: Opaque): value is NamedPropertyGroup {
    return #properties in value
  }

  #properties: SymbolPropertyAccessor[]

  constructor(properties: SymbolPropertyAccessor[]) {
    this.#properties = properties
  }

  get deserialized() {
    return this.#properties[0]?.deserialized === true
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
