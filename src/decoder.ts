import * as cbor from 'cbor2'
import never from 'never'
import { Wtf8Decoder } from '@cto.af/wtf8'
import { type AspectType, type StaticType, isValidAspectType, isValidStaticType } from './serialization-types.ts'
import { BytesAccessor } from './accessors/bytes.ts'

export class Decoder {
  readonly #sequence: cbor.SequenceEvents
  readonly #options: cbor.DecodeOptions = {
    cde: false,
    dcbor: false,
    rejectBigInts: false,
    rejectDuplicateKeys: false,
    rejectFloats: false,
    rejectUndefined: false,
    sortKeys: null,
  }

  constructor(bytes: Uint8Array) {
    this.#sequence = new cbor.SequenceEvents(bytes, this.#options)
  }

  *[Symbol.iterator](): IterableIterator<cbor.MtAiValue> {
    yield* this.#sequence
  }

  hasNext(): boolean {
    return this.#sequence.peek() !== undefined
  }

  int(): number {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType === 0 || majorType === 1) {
      if (typeof value === 'bigint') {
        return never('Unexpected bigint')
      }

      return value as number
    }

    return never(
      `Expected an integer, got major type ${majorType} with additional information ${additionalInformation}`,
    )
  }

  peekStaticType(): StaticType | undefined {
    const boo = this.#sequence.peek()
    if (!boo) return

    const [majorType, _, value] = boo
    if (majorType !== 0) return

    const type = value as number
    return isValidStaticType(type) ? type : undefined
  }

  staticType(): StaticType | undefined {
    if (!this.#sequence.peek()) return

    const type = this.int()
    return isValidStaticType(type) ? type : never(`Invalid static type: ${type}`)
  }

  aspectType(): AspectType | undefined {
    if (!this.#sequence.peek()) return

    const type = this.int()
    return isValidAspectType(type) ? type : never(`Invalid aspect type: ${type}`)
  }

  bigInt(): bigint {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType === 0 || majorType === 1) {
      if (typeof value === 'number') {
        return BigInt(value)
      }

      return value as bigint
    }

    // Decode bignums; major type 6 and tag 2 for positive values, 3 for negative.
    if (majorType === 6 && (value === 2 || value === 3)) {
      const bytes = this.uint8Array()
      const bigint = bytes.reduce((accumulator, byte) => (accumulator << 8n) | BigInt(byte), 0n) // eslint-disable-line no-bitwise
      return value === 2 ? bigint : -1n - bigint
    }

    return never(`Expected a bigint, got major type ${majorType} with additional information ${additionalInformation}`)
  }

  boolean(): boolean {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType === 7 && (additionalInformation === 20 || additionalInformation === 21)) {
      return value as boolean
    }

    return never(`Expected a boolean, got major type ${majorType} with additional information ${additionalInformation}`)
  }

  number(): number {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType === 0 || majorType === 1) {
      if (typeof value === 'bigint') {
        return never('Unexpected bigint')
      }

      return value as number
    }

    if (
      majorType === 7 &&
      (additionalInformation === 25 || additionalInformation === 26 || additionalInformation === 27)
    ) {
      return value as number
    }

    return never(`Expected a number, got major type ${majorType} with additional information ${additionalInformation}`)
  }

  string(): string {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType === 3 && additionalInformation !== 31) {
      return value as string
    }

    if (majorType === 6 && value === 273) {
      const bytes = this.uint8Array()
      return new Wtf8Decoder().decode(bytes)
    }

    return never(
      `Expected a fixed-length text string, got major type ${majorType} with additional information ${additionalInformation}`,
    )
  }

  uint8Array(): Uint8Array {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType === 2 && additionalInformation !== 31) {
      return value as Uint8Array
    }

    return never(
      `Expected a fixed-length byte string, got major type ${majorType} with additional information ${additionalInformation}`,
    )
  }

  annotations<T extends Record<string, boolean | number | string | BytesAccessor>>(): T {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType !== 5 || additionalInformation === 31) {
      return never(
        `Expected a map with defined length, got major type ${majorType} with additional information ${additionalInformation}`,
      )
    }

    const result = {} as unknown as T
    const length = value as number
    for (let i = 0; i < length; i++) {
      const key = this.string() as keyof T
      const [majorType, additionalInformation] = this.#sequence.peek() ?? never()
      let value
      switch (majorType) {
        case 0:
        case 1: {
          value = this.number()
          break
        }

        case 2: {
          const bytes = this.uint8Array()
          value = new BytesAccessor(bytes.buffer, bytes.byteOffset, bytes.byteLength)
          break
        }

        case 3: {
          value = this.string()
          break
        }

        case 7: {
          if (additionalInformation === 20 || additionalInformation === 21) {
            value = this.boolean()
          } else if (additionalInformation === 25 || additionalInformation === 26 || additionalInformation === 27) {
            value = this.number()
          } else {
            return never(`Unexpected major type ${majorType} with additional information ${additionalInformation}`)
          }

          break
        }

        default: {
          return never(`Unexpected major type ${majorType}`)
        }
      }

      result[key] = (value as T[keyof T]) ?? never()
    }

    return result
  }
}
