import { possiblyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import type { Formatter } from '../../formatter.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { FinalFormatOptions, ValueRepresentation } from '../../value.d.ts'
import { ObjectRepresentation, type ObjectAnnotations } from '../objects/object.ts'

export class CryptoKeyRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): CryptoKeyRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  override compare(other: ValueRepresentation) {
    if (!super.compare(other)) return unequal
    return possiblyEqual
  }

  override *iterateProperties() {
    yield* super.iterateProperties('type', 'extractable', 'algorithm', 'usages')
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    super.finalFormat(formatter, {
      disambiguationHint: options?.disambiguationHint === true ? 'CryptoKey' : undefined,
    })
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.cryptoKey)
  }
}
