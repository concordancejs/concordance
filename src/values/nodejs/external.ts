import never from 'never'
import { type Comparison, possiblyEqual, strictlyEqual, unequal } from '../../comparison.ts'
import type { CommonRepresentation, Opaque, ShallowFunctionality, ValueRepresentation } from '../../value.d.ts'
import type { Context } from '../../context.d.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { type ShallowSerializationResult, finished } from '../../serialization-result.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import type { Formatter } from '../../formatter.ts'

export class ExternalRepresentation implements CommonRepresentation, ShallowFunctionality {
  static deserialize(context: DeserializationContext, decoder: Decoder): ExternalRepresentation {
    const { p: pointer } = decoder.annotations<{ p: number }>()
    return new this(context, { pointer })
  }

  readonly #context: Context
  readonly #value: Opaque

  constructor(context: Context, value: Opaque) {
    this.#context = context
    this.#value = value
  }

  get deserialized() {
    return this.#context.deserialized
  }

  get pointer(): number {
    return this.#context.pointer(this, this.#value) ?? never()
  }

  compare(other: ValueRepresentation): Comparison {
    if (!(#value in other)) return unequal
    if (this.#context.deserialized || other.#context.deserialized) {
      // If either context is deserialized, we can't compare them
      return possiblyEqual
    }

    return this.#value === other.#value ? strictlyEqual : unequal
  }

  formatShallow(formatter: Formatter): void {
    formatter.append(formatter.theme.external)
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.external).annotations({
      p: this.pointer,
    })
    return finished
  }
}

void (ExternalRepresentation satisfies new (
  ...arguments_: ConstructorParameters<typeof ExternalRepresentation>
) => ValueRepresentation)
