import never from 'never'
import { ElementAccessor, SparseValueRepresentation } from '../../accessors/element.ts'
import { strictlyEqual, unequal, comparable, type Mode } from '../../comparison.ts'
import { RealValueContext } from '../../real-value-context.ts'
import type { Decoder } from '../../decoder.ts'
import { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Context } from '../../context.d.ts'
import type { FinalFormatOptions, Opaque, ValueRepresentation } from '../../value.d.ts'
import type { Formatter } from '../../formatter.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class ArrayRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ArrayRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  static override is(value: Opaque): value is ArrayRepresentation {
    return #value in value
  }

  readonly #value: Opaque
  readonly #context: Context

  constructor(context: Context, value: Opaque) {
    super(context, value)
    this.#value = value
    this.#context = context
  }

  get length() {
    return this.#context.length(this.#value)
  }

  override get isArrayLike(): boolean {
    return false
  }

  override compare(other: ValueRepresentation, mode: Mode) {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual

    if (mode === 'fuzzy') {
      // In fuzzy mode, allow this array to have >= length as other
      if (this.#context.length(this.#value) >= other.#context.length(other.#value)) {
        return comparable
      }

      return unequal
    }

    // In comprehensive mode, lengths must match exactly
    if (this.#context.length(this.#value) !== other.#context.length(other.#value)) return unequal

    return super.compare(other, mode)
  }

  override *iterateElements() {
    if (DeserializationContext.is(this.#context)) {
      yield* this.#context.iterateElements(this.#value)
      return
    }

    if (!RealValueContext.is(this.#context)) {
      return never()
    }

    const length = this.#context.length(this.#value)
    const nonSparseArrayElements = this.#context.nonSparseArrayElements(this.#value)

    for (let index = 0; index < length; index++) {
      if (nonSparseArrayElements[0]?.[0] === index) {
        const [, element] = nonSparseArrayElements.shift()!
        yield new ElementAccessor(index, this.#context.represent(element))
      } else {
        yield new ElementAccessor(index, new SparseValueRepresentation())
      }
    }
  }

  override *iterateIterable() {
    // No-op
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    super.finalFormat(formatter, {
      array: true,
      disambiguationHint: options?.disambiguationHint === true ? 'Array' : undefined,
    })
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.array, { l: this.#context.length(this.#value) })
  }
}
