import type { Context } from '../../context.d.ts'
import type { DeepFunctionality, FinalFormatOptions, Opaque, ValueRepresentation } from '../../value.d.ts'
import { type Comparison, type Mode, strictlyEqual, unequal } from '../../comparison.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import { Formatter } from '../../formatter.ts'
import type { NamedPropertyAccessor } from '../../accessors/property.ts'
import { StringRepresentation } from '../primitives/string.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

const includeProperties = { include: ['name'] }

export class FunctionRepresentation extends ObjectRepresentation implements DeepFunctionality {
  static override deserialize(context: DeserializationContext, decoder: Decoder): FunctionRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  readonly #context: Context
  readonly #value: Opaque
  #iteratedName?: { property: NamedPropertyAccessor; value: StringRepresentation }

  constructor(context: Context, value: Opaque) {
    super(context, value)
    this.#context = context
    this.#value = value
  }

  override get isArrayLike() {
    return false
  }

  override compare(other: ValueRepresentation, mode: Mode): Comparison {
    // Partial comparison of functions is only sensible when you don't have a reference to the actual function prior
    // to the comparison. Therefore allow fuzzy comparison based on properties alone. This means that functions can
    // be partially compared to a plain object.
    if (mode === 'fuzzy' && ObjectRepresentation.isPlain(other)) {
      return super.compare(other, mode)
    }

    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual

    // Functions can only be compared by reference, however if either value is deserialized this won't be possible.
    // Check whether they're comparable as objects. The comparison algorithm should then proceed to compare properties,
    // which will verify that both values have the same name.
    if (this.#context.deserialized || other.#context.deserialized) {
      return super.compare(other, mode)
    }

    return unequal
  }

  override *iterateProperties() {
    yield* super.iterateProperties(includeProperties)
  }

  preformat() {
    this.#context.notifyNextExplicitlyNamedPropertyAccess(this.#value, 'name', (property, value) => {
      if (StringRepresentation.is(value)) {
        this.#iteratedName = {
          property,
          value,
        }
      }
    })
  }

  shouldFormatNamedProperty(property: NamedPropertyAccessor): boolean {
    return this.#iteratedName?.property !== property
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    // Reset property access notifiers; allowing preformat() to be called again
    this.#context.resetPropertyAccessNotifiers(this.#value)

    const constructorName = this.#context.constructorName(this.#value)
    const { empty, maxDepthReached } = formatter
    const stringTag = this.#context.stringTag(this.#value)

    formatter.prefixWrapped(
      'function.constructorName',
      formatter.encodeTypicalIdentifier((constructorName ?? '') || 'Function'),
    )

    if (this.#iteratedName) {
      formatter.prefix(' ', formatter.theme.function.name.open)
      this.#iteratedName.value.formatTypicalIdentifier(formatter, 'prefix')
      formatter.prefix(formatter.theme.function.name.close, ' ')
    }

    if (stringTag !== undefined) {
      if (stringTag === '') {
        formatter.prefix(formatter.theme.function.stringTag.empty, ' ')
      } else {
        formatter.prefixWrapped('function.stringTag', formatter.encodeTypicalIdentifier(stringTag))
        formatter.prefix(' ')
      }
    }

    if (maxDepthReached) {
      formatter.prefixWrapped('object.bracket', ` ${formatter.theme.maxDepth} `)
    } else if (empty) {
      formatter.prefixWrapped('object.bracket')
    } else {
      formatter.prefix(formatter.theme.object.bracket.open)
    }

    if (options?.disambiguationHint === true || constructorName === undefined || constructorName === '') {
      formatter.prefix(' ')
      let hint = 'Function'
      if (constructorName === undefined) {
        hint += ' (no constructor name)'
      } else if (constructorName === '') {
        hint += ' (empty constructor name)'
      }

      formatter.prefixWrapped('disambiguationHint', hint)
    }

    if (maxDepthReached || empty) {
      formatter.close()
    } else {
      formatter.prefix(Formatter.lineMarker).append(Formatter.lineMarker).close(formatter.theme.object.bracket.close)
    }
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.function)
  }
}
