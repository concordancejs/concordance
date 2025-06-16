import type { Context } from '../../context.d.ts'
import { strictlyEqual, unequal, type Mode } from '../../comparison.ts'
import type { FinalFormatOptions, DeepFunctionality, ValueRepresentation, Opaque } from '../../value.d.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { BytesAccessor } from '../../accessors/bytes.ts'
import type { Formatter } from '../../formatter.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class ArrayBufferViewRepresentation extends ObjectRepresentation implements DeepFunctionality {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ArrayBufferViewRepresentation {
    const { b: bytes, ...objectAnnotations } = decoder.annotations<ObjectAnnotations & { b: BytesAccessor }>()
    return new this(context, {
      bytes,
      ...this.unpackAnnotations(objectAnnotations),
    })
  }

  readonly #context: Context
  readonly #value: Opaque

  constructor(context: Context, value: Opaque) {
    super(context, value)
    this.#context = context
    this.#value = value
  }

  get #bytes() {
    return this.#context.representBytes(this.#value)
  }

  override compare(other: ValueRepresentation, mode: Mode) {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    if (!this.#bytes.compare(other.#bytes)) return unequal

    // Compare iterated properties (see below) and string tags.
    return super.compare(other, mode)
  }

  override *iterateArrayLike() {
    // No-op
  }

  override *iterateIterable() {
    // No-op
  }

  preformat(formatter: Formatter) {
    this.#bytes.formatShallow(formatter)
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    super.finalFormat(formatter, {
      array: true,
      disambiguationHint: options?.disambiguationHint === true ? 'ArrayBufferView' : undefined,
    })
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.arrayBufferView, {
      b: this.#bytes,
    })
  }
}
