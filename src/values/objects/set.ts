import { strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../serialize.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Context } from '../../context.js'
import type { ValueRepresentation } from '../../value.js'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class SetRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): SetRepresentation {
    const { s: size, ...objectAnnotations } = decoder.annotations<ObjectAnnotations & { s: number }>()
    return new this(context, { size, ...this.unpackAnnotations(objectAnnotations) })
  }

  readonly #context: Context
  readonly #value: object

  constructor(context: Context, value: object) {
    super(context, value)
    this.#context = context
    this.#value = value
  }

  override compare(other: ValueRepresentation) {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    if (this.#context.size(this.#value) !== other.#context.size(other.#value)) return unequal

    return super.compare(other)
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.set, {
      s: this.#context.size(this.#value),
    })
  }
}
