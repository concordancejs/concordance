import { strictlyEqual, unequal, type Mode } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Context } from '../../context.d.ts'
import type { FinalFormatOptions, Opaque, ValueRepresentation } from '../../value.d.ts'
import type { Formatter } from '../../formatter.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class SetRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): SetRepresentation {
    const { s: size, ...objectAnnotations } = decoder.annotations<ObjectAnnotations & { s: number }>()
    return new this(context, { size, ...this.unpackAnnotations(objectAnnotations) })
  }

  static override is(value: ValueRepresentation): value is SetRepresentation {
    return #value in value
  }

  readonly #context: Context
  readonly #value: Opaque

  constructor(context: Context, value: Opaque) {
    super(context, value)
    this.#context = context
    this.#value = value
  }

  override compare(other: ValueRepresentation, mode: Mode) {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual

    // In fuzzy mode, the actual (this) can have more items than expected (other)
    if (mode !== 'fuzzy' && this.#context.size(this.#value) !== other.#context.size(other.#value)) {
      return unequal
    }

    return super.compare(other, mode)
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    super.finalFormat(formatter, {
      disambiguationHint: options?.disambiguationHint === true ? 'Set' : undefined,
    })
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.set, {
      s: this.#context.size(this.#value),
    })
  }
}
