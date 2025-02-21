import type { Context } from '../../context.js'
import type { ValueRepresentation } from '../../value.js'
import { type Comparison, strictlyEqual, unequal } from '../../comparison.ts'
import type { Encoder } from '../../serialize.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { DeserializationContext, Decoder } from '../../deserialize.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class FunctionRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): FunctionRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  readonly #context: Context
  readonly #value: object

  constructor(context: Context, value: object) {
    super(context, value)
    this.#context = context
    this.#value = value
  }

  override compare(other: ValueRepresentation): Comparison {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual

    // Functions can only be compared by reference, however if either value is deserialized this won't be possible.
    // Check whether they're comparable as objects. The comparison algorithm should then proceed to compare properties,
    // which will verify that both values have the same name.
    if (this.#context.deserialized || other.#context.deserialized) {
      return super.compare(other)
    }

    return unequal
  }

  override *iterateProperties() {
    yield* super.iterateProperties('name')
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.function)
  }
}
