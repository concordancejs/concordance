import type { SymbolPropertyAccessor } from './accessors/property.ts'
import type { Comparison } from './comparison.ts'
import type { Encoder } from './encoder.ts'
import type { ShallowSerializationResult, SerializationResult } from './serialization-result.ts'

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface ValueRepresentation {
  readonly pointer?: number

  align?(other: ValueRepresentation): void
  compare(other: ValueRepresentation): Comparison
  serialize(encoder: Encoder): SerializationResult
  serializeShallow?(encoder: Encoder): ShallowSerializationResult

  [Symbol.iterator]?(): IterableIterator<ValueRepresentation>
}
