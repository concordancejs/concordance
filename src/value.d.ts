import type { NamedPropertyAccessor, PropertyGroup } from './accessors/property.ts'
import type { Comparison } from './comparison.ts'
import type { Encoder } from './encoder.ts'
import type { ShallowSerializationResult, SerializationResult } from './serialization-result.ts'

export type CommonRepresentation = {
  readonly pointer?: number
  compare(other: ValueRepresentation): Comparison
}

export type ShallowFunctionality = {
  serializeShallow(encoder: Encoder): ShallowSerializationResult
}

export type DeepFunctionality = {
  align?(other: ValueRepresentation): void
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
