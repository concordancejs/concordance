import { comparable, strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Context } from '../../context.js'
import type { ValueRepresentation } from '../../value.js'
import { ArrayRepresentation } from './array.ts' // eslint-disable-line import/no-cycle
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class ArgumentsRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ArgumentsRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  readonly #value: object
  readonly #context: Context

  constructor(context: Context, value: object) {
    super(context, value)
    this.#context = context
    this.#value = value
  }

  override compare(other: ValueRepresentation) {
    // Allow comparing arguments objects to arrays, this is useful in deep-equal tests where it's hard to recreate an
    // arguments object.
    if (this.#context.flags.compareArgumentsToArrays && ArrayRepresentation.is(other)) {
      if (this.#context.length(this.#value) !== other.length) return unequal

      return comparable
    }

    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    if (this.#context.length(this.#value) !== other.#context.length(other.#value)) return unequal

    return comparable
  }

  override *iterateIterable() {
    // Not used for arguments objects. Override to make a no-op.
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.arguments)
  }
}
