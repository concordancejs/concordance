import type { Decoder, DeserializationContext } from '../../deserialize.ts'
import type { Encoder } from '../../serialize.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class ModuleNamespaceObjectRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ModuleNamespaceObjectRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.moduleNamespaceObject)
  }
}
