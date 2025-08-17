import { comparable, strictlyEqual, unequal, type Mode } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Context } from '../../context.d.ts'
import type { FinalFormatOptions, Opaque, ValueRepresentation } from '../../value.d.ts'
import type { Formatter } from '../../formatter.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'
import type { ElementAccessor } from '../../accessors/element.ts'

export class ArgumentsRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ArgumentsRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  readonly #value: Opaque
  readonly #context: Context

  constructor(context: Context, value: Opaque) {
    super(context, value)
    this.#context = context
    this.#value = value
  }

  override get isArrayLike() {
    return false
  }

  override acceptsComparisonFrom(other: ValueRepresentation) {
    return #value in other
  }

  override compare(other: ValueRepresentation, mode: Mode) {
    if (!other.acceptsComparisonFrom(this, mode, 'from-arguments-object')) return unequal
    if (#value in other) {
      if (this.#value === other.#value) return strictlyEqual
      // N.B. Fuzzy mode is not implemented for arguments objects, expect both sides to have the same length.
      if (this.#context.length(this.#value) !== other.#context.length(other.#value)) return unequal
    }

    // If other is not an arguments object, but it does accept a comparison, assume it is comparable.
    return comparable
  }

  override *iterateElements(): IterableIterator<ElementAccessor> {
    yield* this.#context.iterateElements(this.#value)
  }

  override *iterateIterable() {
    // Not used for arguments objects. Override to make a no-op.
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    super.finalFormat(formatter, {
      array: true,
      disambiguationHint: options?.disambiguationHint === true ? '`arguments` object' : undefined,
    })
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.arguments, { l: this.#context.length(this.#value) })
  }
}
