import { strictlyEqual, unequal } from '../comparison.ts'
import type { Encoder } from '../serialize.ts'
import { type SerializationResult, finished } from '../serialization-result.ts'
import type { ValueRepresentation } from '../value.js'

export class BytesAccessor implements ValueRepresentation {
  static is(value: object): value is BytesAccessor {
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

  serialize(encoder: Encoder): SerializationResult {
    encoder.uint8Array(this.#bytes)
    return finished
  }
}
