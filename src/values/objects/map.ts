import type { Context } from '../../context.js'
import type { ValueRepresentation } from '../../value.js'
import { strictlyEqual, unequal } from '../../comparison.ts'
import type { Encoder } from '../../serialize.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Decoder, DeserializationContext } from '../../deserialize.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class MapRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): MapRepresentation {
    const { s: size, ...objectAnnotations } = decoder.annotations<ObjectAnnotations & { s: number }>()
    return new this(context, { size, ...this.unpackAnnotations(objectAnnotations) })
  }

  readonly #value: object
  readonly #context: Context

  constructor(context: Context, value: object) {
    super(context, value)
    this.#value = value
    this.#context = context
  }

  override compare(other: ValueRepresentation) {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    if (this.#context.size(this.#value) !== other.#context.size(other.#value)) return unequal

    return super.compare(other)
  }

  override *iterateIterable() {
    yield* this.#context.iterateMapEntries(this.#value)
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.map, {
      s: this.#context.size(this.#value),
    })
  }
}
