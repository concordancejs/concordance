import type { NamedPropertyAccessor } from './accessors/property.ts'
import type { Comparison, Condition, Mode } from './comparison.ts'
import type { Encoder } from './encoder.ts'
import type { Formatter } from './formatter.ts'
import type { ShallowSerializationResult, SerializationResult } from './serialization-result.ts'
import type { TakeWhile } from './stack.ts'

export type Opaque = object // eslint-disable-line @typescript-eslint/no-restricted-types

export type CommonRepresentation = {
  readonly deserialized: boolean
  readonly pointer?: number
  acceptsComparisonFrom(other: ValueRepresentation, mode: Mode, condition?: Condition): boolean
  compare(other: ValueRepresentation, mode: Mode): Comparison
}

export type ShallowFunctionality = {
  formatShallow(formatter: Formatter): void
  serializeShallow(encoder: Encoder): ShallowSerializationResult
}

export type DeepFunctionality = {
  preformat?(formatter: Formatter): void
  finalFormat(formatter: Formatter, options?: FinalFormatOptions): void
  formatAfterIteration?(formatter: Formatter, value: ValueRepresentation): void
  shouldFormatNamedProperty?(property: NamedPropertyAccessor): boolean
  serialize(encoder: Encoder): SerializationResult
  [Symbol.iterator]?(): IterableIterator<ValueRepresentation>
}

export type GroupFunctionality = {
  align?(other: ValueRepresentation, mode: Mode): void
  [Symbol.iterator]?(): IterableIterator<ValueRepresentation>
}

export type AccessorFunctionality = {
  groupForComparison?(takeWhile: TakeWhile, parent: ValueRepresentation, mode: Mode): GroupRepresentation | undefined
}

type Shallow = ShallowFunctionality & {
  [K in keyof DeepFunctionality]?: never
} & {
  [K in keyof GroupFunctionality]?: never
}

type Deep = DeepFunctionality & {
  [K in keyof ShallowFunctionality]?: never
} & Partial<Record<Exclude<keyof GroupFunctionality, typeof Symbol.iterator>, never>>

type Group = GroupFunctionality & {
  [K in keyof ShallowFunctionality]?: never
} & Partial<Record<Exclude<keyof DeepFunctionality, typeof Symbol.iterator>, never>>

type Accessor = AccessorFunctionality &
  DeepFunctionality & {
    [K in keyof ShallowFunctionality]?: never
  } & Partial<Record<Exclude<keyof GroupFunctionality, typeof Symbol.iterator>, never>>

export type ValueRepresentation = CommonRepresentation & (Shallow | Deep | Group | Accessor)
export type PrimitiveRepresentation = ValueRepresentation & Shallow
export type AccessorRepresentation = ValueRepresentation & Accessor
export type BytesAccessorRepresentation = ValueRepresentation & Shallow
export type GroupRepresentation = CommonRepresentation & Group

/**
 * Options for the finalFormat method. Note that these may be ignored by some representations and are more useful in
 * subclass implementations.
 */
export type FinalFormatOptions = {
  /** Whether to use array brackets. */
  readonly array?: true
  /** Whether to include a disambiguation hint, or, indeed, that hint. */
  readonly disambiguationHint?: true | string
}
