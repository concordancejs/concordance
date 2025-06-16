import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Opaque, ValueRepresentation } from '../../value.d.ts'
import { strictlyEqual, unequal, type Mode } from '../../comparison.ts'
import type { Context } from '../../context.d.ts'
import { Formatter } from '../../formatter.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class ModuleNamespaceObjectRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ModuleNamespaceObjectRepresentation {
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

  override compare(other: ValueRepresentation, mode: Mode) {
    // Module namespace objects are special objects that represent the exports of a module. When used in a partial
    // comparison, requiring an actual module namespace object is not helpful. Allow fuzzy comparison based on
    // properties alone, which means that module namespace objects can be partially compared to a plain object.
    if (mode === 'fuzzy' && ObjectRepresentation.isPlain(other)) {
      return super.compare(other, mode)
    }

    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    if (this.#context.deserialized || other.#context.deserialized) {
      // If either context is deserialized, we can't compare the values directly
      // as they may be different instances. We can only compare the properties.
      return super.compare(other, mode)
    }

    return unequal
  }

  override finalFormat(formatter: Formatter) {
    const { empty, maxDepthReached } = formatter

    // Always use object brackets
    if (empty && !maxDepthReached) {
      formatter.prefixWrapped('object.bracket')
    } else {
      formatter.prefix(formatter.theme.object.bracket.open)
      if (maxDepthReached) {
        if (empty) {
          formatter.prefix(` ${formatter.theme.maxDepth} `, formatter.theme.object.bracket.close)
        } else {
          formatter.append(formatter.theme.maxDepth)
        }
      }
    }

    // Always include the disambiguation hint
    formatter.prefix(' ')
    formatter.prefixWrapped('disambiguationHint', 'Module Namespace Object')

    if (empty) {
      formatter.close()
    } else {
      formatter.prefix(Formatter.lineMarker).append(Formatter.lineMarker).close(formatter.theme.object.bracket.close)
    }
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.moduleNamespaceObject)
  }
}
