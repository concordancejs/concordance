import never from 'never'
import { strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder, DeserializationContext } from '../../deserialize.ts'
import type { Encoder } from '../../serialize.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { partialRequiringTerminator, type SerializationResult } from '../../serialization-result.ts'
import type { Context } from '../../context.js'
import type { ValueRepresentation } from '../../value.js'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class BoxedPrimitiveRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): BoxedPrimitiveRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    const primitive = context.next() ?? never('No primitive value')
    return new this(context, this.unpackAnnotations(objectAnnotations), primitive)
  }

  readonly #primitive: ValueRepresentation
  readonly #value: object

  constructor(context: Context, value: object, primitive: ValueRepresentation) {
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
    this.#primitive.serialize(encoder)
    return partialRequiringTerminator
  }

  override *iterateArrayLike() {
    // No-op
  }
}
