import { type Comparison, possiblyEqual, strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder, DeserializationContext } from '../../deserialize.ts'
import type { Encoder } from '../../serialize.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { type ShallowSerializationResult, finished } from '../../serialization-result.ts'
import type { Context } from '../../context.js'
import type { ValueRepresentation } from '../../value.js'

type Annotations = { k?: string; s?: string; w?: string }

export class SymbolRepresentation implements ValueRepresentation {
  static deserialize(context: DeserializationContext, decoder: Decoder): SymbolRepresentation {
    const { k: key, s: string, w: wellKnown } = decoder.annotations<Annotations>()
    return new this(context, { key, string, wellKnown })
  }

  readonly #context: Context
  readonly #value: object

  constructor(context: Context, value: object) {
    this.#context = context
    this.#value = value
  }

  compare(other: ValueRepresentation): Comparison {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    if (!this.#context.deserialized && !other.#context.deserialized) return unequal

    const { key, wellKnown, string } = this.#context.describeSymbol(this.#value)
    const {
      key: otherKey,
      wellKnown: otherWellKnown,
      string: otherString,
    } = other.#context.describeSymbol(other.#value)
    if (key !== undefined && key === otherKey) return strictlyEqual
    if (wellKnown !== undefined && wellKnown === otherWellKnown) return strictlyEqual
    if (string !== undefined && string === otherString) return possiblyEqual
    return unequal
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.symbol)
    const { key: k, wellKnown: w, string: s } = this.#context.describeSymbol(this.#value)
    encoder.annotations({ k, s, w })
    return finished
  }

  serialize(encoder: Encoder) {
    return this.serializeShallow(encoder)
  }
}
