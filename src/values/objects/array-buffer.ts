import type { Context } from '../../context.js'
import type { ValueRepresentation } from '../../value.js'
import { strictlyEqual, unequal } from '../../comparison.ts'
import type { Encoder } from '../../serialize.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Decoder, DeserializationContext } from '../../deserialize.ts'
import type { BytesAccessor } from '../../accessors/bytes.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class ArrayBufferRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ArrayBufferRepresentation {
    const { b: bytes, ...objectAnnotations } = decoder.annotations<ObjectAnnotations & { b: BytesAccessor }>()
    return new this(context, {
      bytes,
      ...this.unpackAnnotations(objectAnnotations),
    })
  }

  readonly #value: object
  readonly #context: Context

  constructor(context: Context, value: object) {
    super(context, value)
    this.#value = value
    this.#context = context
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

  override *iterateProperties() {
    // For ArrayBuffers, this yields maxByteLength and resizable.
    // For SharedArrayBuffers, this yields maxByteLength and growable.
    yield* super.iterateProperties('maxByteLength', 'growable', 'resizable')
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.arrayBuffer, {
      b: this.#bytes,
    })
  }
}
