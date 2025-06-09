import { strictlyEqual, unequal } from '../comparison.ts'
import type { Encoder } from '../encoder.ts'
import { Formatter } from '../formatter.ts'
import { type ShallowSerializationResult, finished } from '../serialization-result.ts'
import type {
  BytesAccessorRepresentation,
  CommonRepresentation,
  Opaque,
  ShallowFunctionality,
  ValueRepresentation,
} from '../value.d.ts'

export class BytesAccessor implements CommonRepresentation, ShallowFunctionality {
  static is(value: Opaque): value is BytesAccessor {
    return #bytes in value
  }

  readonly #bytes: Uint8Array
  readonly #byteLength: number

  constructor(value: ArrayBufferLike, byteOffset: number, byteLength: number) {
    this.#bytes = new Uint8Array(value, byteOffset, byteLength)
    this.#byteLength = byteLength
  }

  compare(other: ValueRepresentation) {
    if (!(#bytes in other)) return unequal
    if (this.#byteLength !== other.#byteLength) return unequal

    for (let index = 0; index < this.#byteLength; index++) {
      if (this.#bytes[index] !== other.#bytes[index]) return unequal
    }

    return strictlyEqual
  }

  formatShallow(formatter: Formatter): void {
    if (this.#byteLength === 0) {
      formatter.append(formatter.theme.bytes.empty)
      return
    }

    // Display 4-byte words, 8 per line
    const view = new DataView(this.#bytes.buffer, this.#bytes.byteOffset, this.#byteLength)
    for (let offset = 0; offset < view.byteLength; offset += 4) {
      let value
      switch (view.byteLength - offset) {
        case 1: {
          value = view.getUint8(offset).toString(16).padStart(2, '0')
          break
        }

        case 2: {
          value = view.getUint16(offset).toString(16).padStart(4, '0')
          break
        }

        case 3: {
          value = (view.getUint8(offset) * 2 ** 16 + view.getUint16(offset + 1)).toString(16).padStart(6, '0')
          break
        }

        default: {
          value = view.getUint32(offset).toString(16).padStart(8, '0')
          break
        }
      }

      if (offset > 0) {
        formatter.append(offset % 32 === 0 ? Formatter.lineMarker : ' ')
      }

      formatter.appendWrapped('bytes', value)
    }
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.uint8Array(this.#bytes)
    return finished
  }
}

void (BytesAccessor satisfies new (
  ...arguments_: ConstructorParameters<typeof BytesAccessor>
) => BytesAccessorRepresentation)
