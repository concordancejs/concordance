import { strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Context } from '../../context.js'
import type { ValueRepresentation } from '../../value.js'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class DateRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): DateRepresentation {
    const { v: valueOf, ...objectAnnotations } = decoder.annotations<ObjectAnnotations & { v: number }>()
    return new this(context, { valueOf, ...this.unpackAnnotations(objectAnnotations) })
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
    if (!Object.is(this.#context.valueOf(this.#value), other.#context.valueOf(other.#value))) return unequal
    return super.compare(other)
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.date, {
      v: this.#context.valueOf(this.#value) as number,
    })
  }
}
