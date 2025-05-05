import never from 'never'
import { type Comparison, possiblyEqual, strictlyEqual, unequal } from '../../comparison.ts'
import type { ValueRepresentation } from '../../value.js'
import type { Context } from '../../context.js'
import type { Encoder } from '../../serialize.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { type ShallowSerializationResult, finished } from '../../serialization-result.ts'
import type { Decoder, DeserializationContext } from '../../deserialize.ts'

export class ExternalRepresentation implements ValueRepresentation {
  static deserialize(context: DeserializationContext, decoder: Decoder): ExternalRepresentation {
    const { p: pointer } = decoder.annotations<{ p: number }>()
    return new this(context, { pointer })
  }

  readonly #context: Context
  readonly #value: object

  constructor(context: Context, value: object) {
    this.#context = context
    this.#value = value
  }

  get pointer(): number {
    return this.#context.pointer(this, this.#value) ?? never()
  }

  compare(other: ValueRepresentation): Comparison {
    if (!(#value in other)) return unequal
    if (this.#context.deserialized || other.#context.deserialized) {
      // If either context is deserialized, we can't compare them
      return possiblyEqual
    }

    return this.#value === other.#value ? strictlyEqual : unequal
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.external).annotations({
      p: this.pointer,
    })
    return finished
  }

  serialize(encoder: Encoder) {
    return this.serializeShallow(encoder)
  }
}
