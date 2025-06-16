import { unequal, type Mode } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import type { Formatter } from '../../formatter.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { FinalFormatOptions, ValueRepresentation } from '../../value.d.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class ErrorRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ErrorRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  readonly #stamp: undefined

  override compare(other: ValueRepresentation, mode: Mode) {
    // It can be hard to construct a partial error that is still an actual error. Allow fuzzy comparison based on
    // properties alone. This means that errors can be partially compared to a plain object.
    if (mode === 'fuzzy' && ObjectRepresentation.isPlain(other)) {
      return super.compare(other, mode)
    }

    if (!(#stamp in other)) return unequal
    return super.compare(other, mode)
  }

  override *iterateProperties() {
    yield* super.iterateProperties({ exclude: ['stack'], include: ['name', 'cause', 'code', 'message'] })
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    super.finalFormat(formatter, {
      disambiguationHint: options?.disambiguationHint === true ? 'Error' : undefined,
    })
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.error)
  }
}
