import type { Context } from '../../context.js'
import { strictlyEqual, unequal } from '../../comparison.ts'
import type { ValueRepresentation } from '../../value.js'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { BytesAccessor } from '../../accessors/bytes.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class ArrayBufferViewRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ArrayBufferViewRepresentation {
    const { b: bytes, ...objectAnnotations } = decoder.annotations<ObjectAnnotations & { b: BytesAccessor }>()
    return new this(context, {
      bytes,
      ...this.unpackAnnotations(objectAnnotations),
    })
  }

  readonly #context: Context
  readonly #value: object

  constructor(context: Context, value: object) {
    super(context, value)
    this.#context = context
    this.#value = value
  }

  get #bytes() {
    return this.#context.representBytes(this.#value)
  }

  override compare(other: ValueRepresentation) {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    if (!this.#bytes.compare(other.#bytes)) return unequal

    // Compare iterated properties (see below) and string tags.
    return super.compare(other)
  }

  override *iterateArrayLike() {
    // No-op
  }

  override *iterateIterable() {
    // No-op
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.arrayBufferView, {
      b: this.#bytes,
    })
  }
}
