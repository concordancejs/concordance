import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import type { Formatter } from '../../formatter.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { FinalFormatOptions } from '../../value.d.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class ErrorRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ErrorRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  override *iterateProperties() {
    yield* super.iterateProperties('name', 'cause', 'message')
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
