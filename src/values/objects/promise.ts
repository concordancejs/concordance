import { type Comparison, type Mode, strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Context } from '../../context.d.ts'
import type { FinalFormatOptions, Opaque, ValueRepresentation } from '../../value.d.ts'
import type { Formatter } from '../../formatter.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class PromiseRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): PromiseRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  readonly #context: Context
  readonly #value: Opaque

  constructor(context: Context, value: Opaque) {
    super(context, value)
    this.#context = context
    this.#value = value
  }

  override compare(other: ValueRepresentation, mode: Mode): Comparison {
    // Partial comparison of promises is only sensible when you don't have a reference to the actual promise prior
    // to the comparison. Therefore allow fuzzy comparison based on properties alone. This means that promises can
    // be partially compared to a plain object.
    if (mode === 'fuzzy' && ObjectRepresentation.isPlain(other)) {
      return super.compare(other, mode)
    }

    if (!(#value in other)) return unequal

    // Promises can only be compared by reference, however if either value is deserialized this won't be possible.
    // Check whether they're comparable as objects. The comparison algorithm should then proceed to compare properties,
    // if any.
    if (this.#context.deserialized || other.#context.deserialized) {
      return super.compare(other, mode)
    }

    return this.#value === other.#value ? strictlyEqual : unequal
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    super.finalFormat(formatter, {
      disambiguationHint: options?.disambiguationHint === true ? 'Promise' : undefined,
    })
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.promise)
  }
}
