import type { NamedPropertyAccessor } from '../../accessors/property.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { Formatter } from '../../formatter.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { DeepFunctionality, FinalFormatOptions, Opaque, ValueRepresentation } from '../../value.d.ts'
import { StringRepresentation } from '../primitives/string.ts'
import type { Context } from '../../context.d.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'
import { unequal } from '../../comparison.ts'

const includeProperties = { include: ['flags', 'source'] }

export class RegExpRepresentation extends ObjectRepresentation implements DeepFunctionality {
  static override deserialize(context: DeserializationContext, decoder: Decoder): RegExpRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  readonly #context: Context
  readonly #value: Opaque
  #iteratedFlags?: { property: NamedPropertyAccessor; value: StringRepresentation }
  #iteratedSource?: { property: NamedPropertyAccessor; value: StringRepresentation }

  constructor(context: Context, value: Opaque) {
    super(context, value)
    this.#context = context
    this.#value = value
  }

  override compare(other: ValueRepresentation) {
    if (!(#value in other)) return unequal
    return super.compare(other)
  }

  override *iterateProperties() {
    yield* super.iterateProperties(includeProperties)
  }

  preformat() {
    this.#context.notifyNextExplicitlyNamedPropertyAccess(this.#value, 'flags', (property, value) => {
      if (StringRepresentation.is(value)) {
        this.#iteratedFlags = {
          property,
          value,
        }
      }
    })
    this.#context.notifyNextExplicitlyNamedPropertyAccess(this.#value, 'source', (property, value) => {
      if (StringRepresentation.is(value)) {
        this.#iteratedSource = {
          property,
          value,
        }
      }
    })
  }

  shouldFormatNamedProperty(property: NamedPropertyAccessor): boolean {
    return this.#iteratedFlags?.property !== property && this.#iteratedSource?.property !== property
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    // Reset property access notifiers; allowing preformat() to be called again
    this.#context.resetPropertyAccessNotifiers(this.#value)

    const constructorName = this.#context.constructorName(this.#value)
    const stringTag = this.#context.stringTag(this.#value)
    const { empty } = formatter

    const shenanigans = constructorName !== 'RegExp' || stringTag !== undefined || !empty
    // If there are shenanigans and the formatter is not empty, prepend a separator between the source + flags and the
    // rest of the formatter.
    if (shenanigans && !empty) {
      formatter.prepend(Formatter.lineMarker, formatter.theme.regexp.separator, Formatter.lineMarker)
    }

    // Format it as a simple RegExp literal. Note that this uses prepend() and so is in reverse order.
    formatter.prepend(formatter.theme.regexp.flags.close)
    this.#iteratedFlags?.value.formatRaw(formatter, 'prepend')
    formatter.prepend(formatter.theme.regexp.source.close, formatter.theme.regexp.flags.open)
    this.#iteratedSource?.value.formatRaw(formatter, 'prepend')
    formatter.prepend(formatter.theme.regexp.source.open)

    // If there are no other properties or strange deviations, we can close the formatter early.
    if (!shenanigans) {
      formatter.close()
      return
    }

    // Otherwise format like an object. We've already injected the source + flags.
    super.finalFormat(formatter, {
      disambiguationHint: options?.disambiguationHint === true ? 'RegExp' : undefined,
    })
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.regExp)
  }
}
