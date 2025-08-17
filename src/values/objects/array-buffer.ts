import type { Context } from '../../context.d.ts'
import type { DeepFunctionality, FinalFormatOptions, Opaque, ValueRepresentation } from '../../value.d.ts'
import { strictlyEqual, unequal, type Mode } from '../../comparison.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { BytesAccessor } from '../../accessors/bytes.ts'
import type { Formatter } from '../../formatter.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

const includeProperties = { include: ['maxByteLength', 'growable', 'resizable'] }
export class ArrayBufferRepresentation extends ObjectRepresentation implements DeepFunctionality {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ArrayBufferRepresentation {
    const { b: bytes, ...objectAnnotations } = decoder.annotations<ObjectAnnotations & { b: BytesAccessor }>()
    return new this(context, {
      bytes,
      ...this.unpackAnnotations(objectAnnotations),
    })
  }

  readonly #value: Opaque
  readonly #context: Context

  constructor(context: Context, value: Opaque) {
    super(context, value)
    this.#value = value
    this.#context = context
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

  override *iterateProperties() {
    // For ArrayBuffers, this yields maxByteLength and resizable.
    // For SharedArrayBuffers, this yields maxByteLength and growable.
    yield* super.iterateProperties(includeProperties)
  }

  preformat(formatter: Formatter) {
    this.#bytes.formatShallow(formatter)
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    super.finalFormat(formatter, {
      array: true,
      disambiguationHint: options?.disambiguationHint === true ? 'ArrayBuffer' : undefined,
    })
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.arrayBuffer, {
      b: this.#bytes,
    })
  }
}
