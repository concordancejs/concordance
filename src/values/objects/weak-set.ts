import { possiblyEqual, strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Context } from '../../context.js'
import type { ValueRepresentation } from '../../value.js'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class WeakSetRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): WeakSetRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  readonly #value: object

  constructor(context: Context, value: object) {
    super(context, value)
    this.#value = value
  }

  override compare(other: ValueRepresentation) {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    return super.compare(other) ? possiblyEqual : unequal
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.weakSet)
  }
}
