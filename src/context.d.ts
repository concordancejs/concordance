import type { BytesAccessor } from './accessors/bytes.ts'
import type { IteratorValueAccessor } from './accessors/iterator-value.ts'
import type { MapEntryAccessor } from './accessors/map-entry.ts'
import type { NamedPropertyGroup, SymbolPropertyGroup } from './accessors/property.ts'
import type { Flags } from './flags.ts'
import type { ValueRepresentation } from './value.js'

export type ContextOptions = {
  flags?: Partial<Flags>
}

export type PropertyAccessCallback = (property: NamedPropertyAccessor, value: ValueRepresentation) => void

export type Context = {
  readonly deserialized: boolean
  readonly flags: Readonly<Flags>
  constructorName(value: object): string | undefined
  describeSymbol(value: object): DescribedSymbol
  isArrayLike(value: object): boolean
  isNullProto(value: object): boolean
  isObjectProto(value: object): boolean
  iterateElements(value: object): Iterable<ElementAccessor>
  iterateMapEntries(value: object): Iterable<MapEntryAccessor>
  iterateValues(value: object): Iterable<IteratorValueAccessor>
  length(value: object): number
  namedProperties(value: object, ...include: string[]): NamedPropertyGroup
  notifyNextExplicitlyNamedPropertyAccess(value: object, name: string, callback: PropertyAccessCallback): void
  pointer(representation: ValueRepresentation, value: object): number | undefined
  representBytes(value: object): BytesAccessor
  resetPropertyAccessNotifiers(value: object): void
  size(value: object): number
  stringTag(value: object): string | undefined
  symbolProperties(value: object): SymbolPropertyGroup
  valueOf(value: object): unknown
}

export type DescribedSymbol =
  | { key: string; wellKnown: undefined; string: undefined }
  | { key: undefined; wellKnown: string; string: undefined }
  | { key: undefined; wellKnown: undefined; string: string }
