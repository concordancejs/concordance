import never from 'never'
import { strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { partialRequiringTerminator, type SerializationResult } from '../../serialization-result.ts'
import type { Context } from '../../context.js'
import type { PrimitiveRepresentation, ValueRepresentation } from '../../value.js'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class BoxedPrimitiveRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): BoxedPrimitiveRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    const primitive = (context.next() ?? never('No primitive value')) as PrimitiveRepresentation
    return new this(context, this.unpackAnnotations(objectAnnotations), primitive)
  }

  readonly #primitive: PrimitiveRepresentation
  readonly #value: object

  constructor(context: Context, value: object, primitive: PrimitiveRepresentation) {
    super(context, value)
    this.#primitive = primitive
    this.#value = value
  }

  override compare(other: ValueRepresentation) {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    if (!this.#primitive.compare(other.#primitive)) return unequal
    return super.compare(other)
  }

  override serialize(encoder: Encoder): SerializationResult {
    super.serialize(encoder, staticTypeTable.boxedPrimitive)
    this.#primitive.serializeShallow(encoder)
    return partialRequiringTerminator
  }

  override *iterateArrayLike() {
    // No-op
  }
}
