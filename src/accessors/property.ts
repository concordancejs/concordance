import { type Comparison, comparable, strictlyEqual, unequal, possiblyEqual } from '../comparison.ts'
import type { Encoder } from '../encoder.ts'
import { type SerializationResult, partial } from '../serialization-result.ts'
import type {
  AccessorFunctionality,
  AccessorRepresentation,
  CommonRepresentation,
  DeepFunctionality,
  GroupFunctionality,
  GroupRepresentation,
  Opaque,
  ValueRepresentation,
} from '../value.d.ts'
import type { SymbolRepresentation } from '../values/primitives/symbol.ts'
import type { Formatter } from '../formatter.ts'
import type { TakeWhile } from '../stack.ts'

export class NamedPropertyAccessor implements CommonRepresentation, DeepFunctionality {
  static is(value: ValueRepresentation): value is NamedPropertyAccessor {
    return #key in value
  }

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

export class SymbolPropertyAccessor implements CommonRepresentation, DeepFunctionality, AccessorFunctionality {
  static is(value: ValueRepresentation): value is SymbolPropertyAccessor {
    return #key in value
  }

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

  groupForComparison(takeWhile: TakeWhile, parent: ValueRepresentation): SymbolPropertyGroup | undefined {
    if (SymbolPropertyGroup.is(parent)) {
      return
    }

    const properties = [this, ...takeWhile((value) => SymbolPropertyAccessor.is(value))]
    return new SymbolPropertyGroup(properties)
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

export class NamedPropertyGroup implements CommonRepresentation, GroupFunctionality {
  static is(value: Opaque): value is NamedPropertyGroup {
    return #properties in value
  }

  readonly #properties: NamedPropertyAccessor[]

  constructor(properties: NamedPropertyAccessor[]) {
    this.#properties = properties
  }

  get deserialized() {
    return this.#properties[0]?.deserialized === true
  }

  *[Symbol.iterator]() {
    yield* this.#properties
  }

  compare(other: ValueRepresentation): Comparison {
    return #properties in other ? comparable : unequal
  }
}

void (NamedPropertyGroup satisfies new (
  ...arguments_: ConstructorParameters<typeof NamedPropertyGroup>
) => GroupRepresentation)

export class SymbolPropertyGroup implements CommonRepresentation, GroupFunctionality {
  static is(value: Opaque): value is SymbolPropertyGroup {
    return #properties in value
  }

  #properties: SymbolPropertyAccessor[]

  constructor(properties: SymbolPropertyAccessor[]) {
    this.#properties = properties
  }

  get deserialized() {
    return this.#properties[0]?.deserialized === true
  }

  align(other: SymbolPropertyGroup) {
    const [aligned, otherAligned] = SymbolPropertyAccessor.orderByIntersection(this.#properties, other.#properties)
    this.#properties = aligned
    other.#properties = otherAligned
  }

  compare(other: ValueRepresentation): Comparison {
    return #properties in other ? comparable : unequal
  }

  *[Symbol.iterator]() {
    yield* this.#properties
  }
}

void (SymbolPropertyGroup satisfies new (
  ...arguments_: ConstructorParameters<typeof SymbolPropertyGroup>
) => GroupRepresentation)
