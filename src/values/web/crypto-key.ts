import { unequal, type Mode } from '../../comparison.ts'
import type { Context } from '../../context'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import type { Formatter } from '../../formatter.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { FinalFormatOptions, Opaque, ValueRepresentation } from '../../value.d.ts'
import { ObjectRepresentation, type ObjectAnnotations } from '../objects/object.ts'

const includeProperties = { include: ['type', 'extractable', 'algorithm', 'usages'] }

export class CryptoKeyRepresentation extends ObjectRepresentation {
  static override deserialize(context: DeserializationContext, decoder: Decoder): CryptoKeyRepresentation {
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

  override acceptsComparisonFrom(other: ValueRepresentation) {
    return #context in other
  }

  override compare(other: ValueRepresentation, mode: Mode) {
    // CryptoKeys are inherently hard to compare, since their private portions cannot be directly accessed. Therefore
    // allow them to be fuzzily compared when `other` accepts a plain-object comparison.
    if (mode === 'fuzzy' && other.acceptsComparisonFrom(this, mode, 'if-plain')) {
      return super.compare(other, mode)
    }

    if (!(#context in other)) return unequal
    return super.compare(other, mode)
  }

  override *iterateProperties() {
    // Only include properties relevant to the CryptoKey interface, not symbols specific to Node.js.
    yield* this.#context.namedProperties(this.#value, includeProperties)
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    super.finalFormat(formatter, {
      disambiguationHint: options?.disambiguationHint === true ? 'CryptoKey' : undefined,
    })
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.cryptoKey)
  }
}
