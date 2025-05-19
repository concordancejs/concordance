import type * as cbor from 'cbor2'
import { Writer } from 'cbor2/writer'
import {
  writeBigInt,
  writeFloat,
  writeInt,
  writeLength,
  writeString,
  writeUint8Array,
  writeUnknown,
} from 'cbor2/encoder'
import type { BytesAccessor } from './accessors/bytes.ts'
import { type StaticType, staticTypeTable } from './serialization-types.ts'

export class Encoder {
  readonly #writer = new Writer()
  readonly #options: cbor.RequiredEncodeOptions = {
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
    wtf8: true,
    types: null,
  }

  get bytes(): Uint8Array {
    return this.#writer.read()
  }

  staticType(type: StaticType): this {
    writeInt(type, this.#writer)
    return this
  }

  int(value: number): this {
    writeInt(value, this.#writer)
    return this
  }

  bigInt(value: bigint): this {
    writeBigInt(value, this.#writer, this.#options)
    return this
  }

  boolean(value: boolean): this {
    writeUnknown(value, this.#writer, this.#options)
    return this
  }

  number(value: number): this {
    if (Object.is(value, -0) || !Number.isSafeInteger(value)) {
      writeFloat(value, this.#writer, this.#options)
    } else {
      writeInt(value, this.#writer)
    }

    return this
  }

  string(value: string): this {
    writeString(value, this.#writer, this.#options)
    return this
  }

  uint8Array(value: Uint8Array): this {
    writeUint8Array(value, this.#writer)
    return this
  }

  annotations<T extends Partial<Record<string, boolean | number | string | BytesAccessor>>>(value: T): this {
    const entries = Object.entries(value).filter(
      (entry): entry is [string, Exclude<(typeof value)[string], undefined>] => entry[1] !== undefined,
    )
    writeLength(entries, entries.length, 5, this.#writer, this.#options)
    for (const [k, v] of entries) {
      writeString(k, this.#writer, this.#options)
      if (typeof v === 'object') {
        v.serialize(this)
      } else {
        writeUnknown(v, this.#writer, this.#options)
      }
    }

    return this
  }

  terminator(): this {
    writeInt(staticTypeTable.terminator, this.#writer)
    return this
  }
}
