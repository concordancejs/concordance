import { unequal, type Mode } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Context } from '../../context.d.ts'
import type { FinalFormatOptions, Opaque, ValueRepresentation } from '../../value.d.ts'
import type { Formatter } from '../../formatter.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class WeakMapRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): WeakMapRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  readonly #value: Opaque

  constructor(context: Context, value: Opaque) {
    super(context, value)
    this.#value = value
  }

  override acceptsComparisonFrom(other: ValueRepresentation) {
    return #value in other
  }

  override compare(other: ValueRepresentation, mode: Mode) {
    // Since WeakMaps are not enumerable, requiring an actual WeakMap in a fuzzy comparison does not add much value.
    // Allow fuzzy comparison based when `other` accepts a plain-object comparison.
    if (mode === 'fuzzy' && other.acceptsComparisonFrom(this, mode, 'if-plain')) {
      return super.compare(other, mode)
    }

    if (!(#value in other)) return unequal
    return super.compare(other, mode)
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    super.finalFormat(formatter, {
      disambiguationHint: options?.disambiguationHint === true ? 'WeakMap' : undefined,
    })
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.weakMap)
  }
}
