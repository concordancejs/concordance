import type { NamedPropertyAccessor, PropertyGroup } from './accessors/property.ts'
import type { Comparison } from './comparison.ts'
import type { Encoder } from './encoder.ts'
import type { Formatter } from './formatter.ts'
import type { ShallowSerializationResult, SerializationResult } from './serialization-result.ts'

export type Opaque = object // eslint-disable-line @typescript-eslint/no-restricted-types

export type CommonRepresentation = {
  readonly pointer?: number
  compare(other: ValueRepresentation): Comparison
}

export type ShallowFunctionality = {
  formatShallow(formatter: Formatter): void
  serializeShallow(encoder: Encoder): ShallowSerializationResult
}

export type DeepFunctionality = {
  align?(other: ValueRepresentation): void
  preformat?(formatter: Formatter): void
  finalFormat(formatter: Formatter, options?: FinalFormatOptions): void
  formatAfterIteration?(formatter: Formatter, value: ValueRepresentation): void
  shouldFormatNamedProperty?(property: NamedPropertyAccessor): boolean
  serialize(encoder: Encoder): SerializationResult
  [Symbol.iterator]?(): IterableIterator<ValueRepresentation | PropertyGroup>
}

type Shallow = CommonRepresentation &
  ShallowFunctionality & {
    [K in keyof DeepFunctionality]?: never
  }

type Deep = CommonRepresentation &
  DeepFunctionality & {
    [K in keyof ShallowFunctionality]?: never
  }

export type ValueRepresentation = CommonRepresentation & (Shallow | Deep)
export type PrimitiveRepresentation = ValueRepresentation & Shallow
export type AccessorRepresentation = ValueRepresentation & Deep
export type BytesAccessorRepresentation = ValueRepresentation & Shallow

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
