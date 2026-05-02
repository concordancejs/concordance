import never from 'never'
import { strictlyEqual, unequal, type Mode } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { partialRequiringTerminator, type SerializationResult } from '../../serialization-result.ts'
import type { Context } from '../../context.d.ts'
import type {
  DeepFunctionality,
  FinalFormatOptions,
  Opaque,
  PrimitiveRepresentation,
  ValueRepresentation,
} from '../../value.d.ts'
import type { Formatter } from '../../formatter.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class BoxedPrimitiveRepresentation extends ObjectRepresentation implements DeepFunctionality {
  static override deserialize(context: DeserializationContext, decoder: Decoder): BoxedPrimitiveRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    const primitive = (context.next() ?? never('No primitive value')) as PrimitiveRepresentation // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
    return new this(context, this.unpackAnnotations(objectAnnotations), primitive)
  }

  readonly #primitive: PrimitiveRepresentation
  readonly #value: Opaque

  constructor(context: Context, value: Opaque, primitive: PrimitiveRepresentation) {
    super(context, value)
    this.#primitive = primitive
    this.#value = value
  }

  override get isArrayLike() {
    return false
  }

  override acceptsComparisonFrom(other: ValueRepresentation) {
    return #value in other
  }

  override compare(other: ValueRepresentation, mode: Mode) {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    if (!this.#primitive.compare(other.#primitive, mode)) return unequal
    return super.compare(other, mode)
  }

  preformat(formatter: Formatter) {
    this.#primitive.formatShallow(formatter)
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    super.finalFormat(formatter, {
      disambiguationHint: options?.disambiguationHint === true ? 'Boxed primitive' : undefined,
    })
  }

  override serialize(encoder: Encoder): SerializationResult {
    super.serialize(encoder, staticTypeTable.boxedPrimitive)
    this.#primitive.serializeShallow(encoder)
    return partialRequiringTerminator
  }
}
