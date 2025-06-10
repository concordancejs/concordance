import never from 'never'
import type { ValueRepresentation } from './value.d.ts'
import { Stack } from './stack.ts'
import { Encoder } from './encoder.ts'
import { ElementAccessor } from './accessors/element.ts'
import { NamedPropertyGroup, SymbolPropertyGroup } from './accessors/property.ts'
import { IteratorValueAccessor } from './accessors/iterator-value.ts'
import { MapEntryAccessor } from './accessors/map-entry.ts'
import { finished, partial, partialRequiringTerminator } from './serialization-result.ts'
import { type AspectType, staticTypeTable, version } from './serialization-types.ts'

type StackFields = {
  lastAspect?: AspectType
  requiresTerminator?: boolean
}

// eslint-disable-next-line complexity
export function serialize(value: ValueRepresentation): Uint8Array {
  const encoder = new Encoder()
  encoder.int(version)

  const stack = new Stack<StackFields>()
  const seen = new Set<number>()
  do {
    const { top } = stack
    if (top) {
      if (ElementAccessor.is(value)) {
        if (top.lastAspect !== staticTypeTable.elementAspect) {
          encoder.staticType(staticTypeTable.elementAspect)
          top.lastAspect = staticTypeTable.elementAspect
        }
      } else if (NamedPropertyGroup.is(value)) {
        if (top.lastAspect !== staticTypeTable.namedPropertyAspect) {
          encoder.staticType(staticTypeTable.namedPropertyAspect)
          top.lastAspect = staticTypeTable.namedPropertyAspect
        }
      } else if (SymbolPropertyGroup.is(value)) {
        if (top.lastAspect !== staticTypeTable.symbolPropertyAspect) {
          encoder.staticType(staticTypeTable.symbolPropertyAspect)
          top.lastAspect = staticTypeTable.symbolPropertyAspect
        }
      } else if (IteratorValueAccessor.is(value)) {
        if (top.lastAspect !== staticTypeTable.iteratorValueAspect) {
          encoder.staticType(staticTypeTable.iteratorValueAspect)
          top.lastAspect = staticTypeTable.iteratorValueAspect
        }
      } else if (MapEntryAccessor.is(value) && top.lastAspect !== staticTypeTable.mapEntryAspect) {
        encoder.staticType(staticTypeTable.mapEntryAspect)
        top.lastAspect = staticTypeTable.mapEntryAspect
      }
    }

    const { pointer } = value
    if (pointer === undefined || !seen.has(pointer)) {
      if (pointer !== undefined) {
        seen.add(pointer)
      }

      const result = value.serializeShallow?.(encoder) ?? value.serialize?.(encoder) ?? partial
      switch (result) {
        case finished: {
          break
        }

        case partial:
        case partialRequiringTerminator: {
          stack.push(value, {
            requiresTerminator: result === partialRequiringTerminator,
            lastAspect: undefined,
          })
          break
        }
      }
    } else {
      encoder.staticType(staticTypeTable.pointer).int(pointer)
    }

    while (!stack.empty) {
      const next = stack.iterateNext()
      if (next) {
        value = next
        break
      }

      const { requiresTerminator = false } = stack.pop() ?? never()
      if (requiresTerminator) encoder.terminator()
    }
  } while (!stack.empty)

  return encoder.bytes
}
