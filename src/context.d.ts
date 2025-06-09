import type { BytesAccessor } from './accessors/bytes.ts'
import type { IteratorValueAccessor } from './accessors/iterator-value.ts'
import type { MapEntryAccessor } from './accessors/map-entry.ts'
import type { NamedPropertyGroup, SymbolPropertyGroup } from './accessors/property.ts'
import type { Flags } from './flags.ts'
import type { Opaque, ValueRepresentation } from './value.d.ts'

export type ContextOptions = {
  flags?: Partial<Flags>
}

export type PropertyAccessCallback = (property: NamedPropertyAccessor, value: ValueRepresentation) => void

export type Context = {
  readonly deserialized: boolean
  readonly flags: Readonly<Flags>
  constructorName(value: Opaque): string | undefined
  describeSymbol(value: Opaque): DescribedSymbol
  isArrayLike(value: Opaque): boolean
  isNullProto(value: Opaque): boolean
  isObjectProto(value: Opaque): boolean
  iterateElements(value: Opaque): Iterable<ElementAccessor>
  iterateMapEntries(value: Opaque): Iterable<MapEntryAccessor>
  iterateValues(value: Opaque): Iterable<IteratorValueAccessor>
  length(value: Opaque): number
  namedProperties(value: Opaque, ...include: string[]): NamedPropertyGroup
  notifyNextExplicitlyNamedPropertyAccess(value: Opaque, name: string, callback: PropertyAccessCallback): void
  pointer(representation: ValueRepresentation, value: Opaque): number | undefined
  representBytes(value: Opaque): BytesAccessor
  resetPropertyAccessNotifiers(value: Opaque): void
  size(value: Opaque): number
  stringTag(value: Opaque): string | undefined
  symbolProperties(value: Opaque): SymbolPropertyGroup
  valueOf(value: Opaque): unknown
}

export type DescribedSymbol =
  | { key: string; wellKnown: undefined; string: undefined }
  | { key: undefined; wellKnown: string; string: undefined }
  | { key: undefined; wellKnown: undefined; string: string }
