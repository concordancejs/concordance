import never from 'never'
import { ElementAccessor, SparseValueRepresentation } from '../../accessors/element.ts'
import { strictlyEqual, unequal } from '../../comparison.ts'
import { DescriptionContext } from '../../describe.ts' // eslint-disable-line import/no-cycle
import type { Decoder } from '../../decoder.ts'
import { DeserializationContext } from '../../deserialization-context.ts' // eslint-disable-line import/no-cycle
import type { Encoder } from '../../serialize.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Context } from '../../context.js'
import type { ValueRepresentation } from '../../value.js'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class ArrayRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): ArrayRepresentation {
    const objectAnnotations = decoder.annotations<ObjectAnnotations>()
    return new this(context, this.unpackAnnotations(objectAnnotations))
  }

  static override is(value: object): value is ArrayRepresentation {
    return #value in value
  }

  readonly #value: object
  readonly #context: Context

  constructor(context: Context, value: object) {
    super(context, value)
    this.#value = value
    this.#context = context
  }

  get length() {
    return this.#context.length(this.#value)
  }

  override compare(other: ValueRepresentation) {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    if (this.#context.length(this.#value) !== other.#context.length(other.#value)) return unequal

    return super.compare(other)
  }

  override *iterateArrayLike() {
    if (DeserializationContext.is(this.#context)) {
      yield* this.#context.iterateElements(this.#value)
      return
    }

    if (!DescriptionContext.is(this.#context)) {
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

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.array)
  }
}
