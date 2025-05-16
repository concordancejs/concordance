import { possiblyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../serialize.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { ValueRepresentation } from '../../value.js'
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

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.cryptoKey)
  }
}
