import * as cbor from 'cbor2/encoder'
import { Writer } from 'cbor2/writer'
import type { RequiredEncodeOptions } from 'cbor2'
import never from 'never'
import type { ValueRepresentation } from './value.js'
import { Stack } from './stack.ts'
import { ElementAccessor } from './accessors/element.ts'
import { NamedPropertyGroup, SymbolPropertyGroup } from './accessors/property.ts'
import { IteratorValueAccessor } from './accessors/iterator-value.ts'
import { MapEntryAccessor } from './accessors/map-entry.ts'
import type { BytesAccessor } from './accessors/bytes.ts'
import { finished, partial, partialRequiringTerminator, partialStoreAsByteArray } from './serialization-result.ts'
import { type AspectType, type StaticType, staticTypeTable, version } from './serialization-types.ts'

export class Encoder {
  readonly #writer = new Writer()
  readonly #options: RequiredEncodeOptions = {
    chunkSize: 4096,
    avoidInts: false,
    cde: false,
    collapseBigInts: true,
    dcbor: false,
    float64: false,
    flushToZero: false,
    forceEndian: false, // Default to big-endian.
    ignoreOriginalEncoding: true,
    largeNegativeAsBigInt: false,
    reduceUnsafeNumbers: false,
    rejectBigInts: false,
    rejectCustomSimples: false,
    rejectDuplicateKeys: false,
    rejectFloats: false,
    rejectUndefined: false,
    simplifyNegativeZero: false,
    sortKeys: null,
    stringNormalization: null,
  }

  get bytes(): Uint8Array {
    return this.#writer.read()
  }

  staticType(type: StaticType): this {
    cbor.writeInt(type, this.#writer)
    return this
  }

  int(value: number): this {
    cbor.writeInt(value, this.#writer)
    return this
  }

  bigInt(value: bigint): this {
    cbor.writeBigInt(value, this.#writer, this.#options)
    return this
  }

  boolean(value: boolean): this {
    cbor.writeUnknown(value, this.#writer, this.#options)
    return this
  }

  number(value: number): this {
    if (Object.is(value, -0) || !Number.isSafeInteger(value)) {
      cbor.writeFloat(value, this.#writer, this.#options)
    } else {
      cbor.writeInt(value, this.#writer)
    }

    return this
  }

  string(value: string): this {
    cbor.writeString(value, this.#writer, this.#options)
    return this
  }

  uint8Array(value: Uint8Array): this {
    cbor.writeUint8Array(value, this.#writer)
    return this
  }

  annotations<T extends Partial<Record<string, boolean | number | string | BytesAccessor>>>(value: T): this {
    const entries = Object.entries(value)
      .filter((entry): entry is [string, Exclude<(typeof value)[string], undefined>] => entry[1] !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    cbor.writeLength(entries, entries.length, 5, this.#writer, this.#options)
    for (const [k, v] of entries) {
      cbor.writeString(k, this.#writer, this.#options)
      if (typeof v === 'object') {
        v.serialize(this)
      } else {
        cbor.writeUnknown(v, this.#writer, this.#options)
      }
    }

    return this
  }

  terminator(): this {
    cbor.writeInt(staticTypeTable.terminator, this.#writer)
    return this
  }
}

type StackFields = {
  lastAspect?: AspectType
  requiresTerminator?: boolean
  encoder?: Encoder
}

// eslint-disable-next-line complexity
export function serialize(value: ValueRepresentation): Uint8Array {
  const rootEncoder = new Encoder()
  rootEncoder.int(version)

  const stack = new Stack<StackFields>()
  const seen = new Set<number>()
  do {
    const { top } = stack
    const encoder = top?.encoder ?? rootEncoder
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

      const result = value.serialize(encoder)
      switch (result) {
        case finished: {
          break
        }

        case partial:
        case partialRequiringTerminator:
        case partialStoreAsByteArray: {
          stack.push(value, {
            requiresTerminator: result === partialRequiringTerminator,
            encoder: result === partialStoreAsByteArray ? new Encoder() : encoder,
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
      if (next.done) {
        const { requiresTerminator = false, encoder = rootEncoder } = stack.pop() ?? never()
        if (requiresTerminator) encoder.terminator()
        if (encoder !== rootEncoder && encoder !== stack.top?.encoder) {
          ;(stack.top?.encoder ?? rootEncoder).uint8Array(encoder.bytes)
        }

        continue
      } else {
        value = next.value
        break
      }
    }
  } while (!stack.empty)

  return rootEncoder.bytes
}
