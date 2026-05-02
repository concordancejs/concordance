import { strictlyEqual, unequal, type Mode } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { Context } from '../../context.d.ts'
import type { DeepFunctionality, FinalFormatOptions, Opaque, ValueRepresentation } from '../../value.d.ts'
import type { Formatter } from '../../formatter.ts'
import { ObjectRepresentation, type ObjectAnnotations } from './object.ts'

export class DateRepresentation extends ObjectRepresentation implements DeepFunctionality {
  static override deserialize(context: DeserializationContext, decoder: Decoder): DateRepresentation {
    const { v: valueOf, ...objectAnnotations } = decoder.annotations<ObjectAnnotations & { v: number }>()
    return new this(context, { valueOf, ...this.unpackAnnotations(objectAnnotations) })
  }

  readonly #context: Context
  readonly #value: Opaque

  constructor(context: Context, value: Opaque) {
    super(context, value)
    this.#context = context
    this.#value = value
  }

  override acceptsComparisonFrom(other: ValueRepresentation) {
    return #value in other
  }

  override compare(other: ValueRepresentation, mode: Mode) {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual
    if (!Object.is(this.#context.valueOf(this.#value), other.#context.valueOf(other.#value))) return unequal
    return super.compare(other, mode)
  }

  preformat(formatter: Formatter) {
    const sinceEpoch = this.#context.valueOf(this.#value) as number // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
    if (Number.isNaN(sinceEpoch)) {
      formatter.append(formatter.theme.date.invalid)
    } else {
      const date = new Date(sinceEpoch)
      formatter.appendWrapped(
        'date',
        date.toISOString().replace('T', ' ').replace(/\..+$/, ` ${date.getUTCMilliseconds()}ms UTC`),
      )
    }
  }

  override finalFormat(formatter: Formatter, options?: FinalFormatOptions) {
    super.finalFormat(formatter, {
      disambiguationHint: options?.disambiguationHint === true ? 'Date' : undefined,
    })
  }

  override serialize(encoder: Encoder) {
    return super.serialize(encoder, staticTypeTable.date, {
      v: this.#context.valueOf(this.#value) as number, // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
    })
  }
}
