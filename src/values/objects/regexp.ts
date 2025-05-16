import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../serialize.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class RegExpRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): RegExpRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  override *iterateProperties() {
    yield* super.iterateProperties('flags', 'source')
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.regExp)
  }
}
