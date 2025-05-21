import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { ValueRepresentation } from '../../value.js'
import { strictlyEqual, unequal } from '../../comparison.ts'
import type { Context } from '../../context.js'
import { Formatter } from '../../formatter.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class ModuleNamespaceObjectRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ModuleNamespaceObjectRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  readonly #context: Context
  readonly #value: object

  constructor(context: Context, value: object) {
    super(context, value)
    this.#context = context
    this.#value = value
  }

  override compare(other: ValueRepresentation) {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    if (this.#context.deserialized || other.#context.deserialized) {
      // If either context is deserialized, we can't compare the values directly
      // as they may be different instances. We can only compare the properties.
      return super.compare(other)
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
