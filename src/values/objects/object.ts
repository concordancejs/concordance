import never from 'never'
import type { ValueRepresentation } from '../../value.js'
import type { ElementAccessor } from '../../accessors/element.ts'
import type { IteratorValueAccessor } from '../../accessors/iterator-value.ts'
import type { PropertyGroup } from '../../accessors/property.ts'
import type { MapEntryAccessor } from '../../accessors/map-entry.ts'
import { type Comparison, comparable, strictlyEqual, unequal } from '../../comparison.ts'
import type { Context } from '../../context.js'
import type { BytesAccessor } from '../../accessors/bytes.ts'
import type { Encoder } from '../../serialize.ts'
import { staticTypeTable, type StaticType } from '../../serialization-types.ts'
import { partialRequiringTerminator, type SerializationResult } from '../../serialization-result.ts'
import type { Decoder, DeserializationContext } from '../../deserialize.ts'

export type ObjectAnnotations = {
  a?: true // Is array like
  c?: string // Constructor name; elided in favor of `q` if equal to the string tag
  l?: number // Length of array-like
  n?: true // Has null prototype
  o?: true // Has object prototype
  p: number // Pointer
  q?: string // Constructor name *and* string tag
  t?: string // String tag, undefined if not set; elided in favor of `q` if equal to the constructor name
}

type UnpackedAnnotations = {
  isArrayLike: boolean
  constructorName?: string
  length?: number
  isNullProto: boolean
  isObjectProto: boolean
  pointer: number
  stringTag?: string
}

type KnownAnnotations = {
  b?: BytesAccessor // Bytes
  s?: number // Size of map or set
  v?: boolean | number | string // "value of"
}

// This is a sentinel value used to indicate that the annotation is reserved for internal use. Because it's not
// exported, calling code cannot assign it to the reserved properties.
const reserved = Symbol('Sentinel value for reserved annotations')
type Reserved<T> = { [K in keyof Required<T>]?: typeof reserved }

export type SerializationAnnotations = Record<string, boolean | number | string | BytesAccessor> &
  Reserved<ObjectAnnotations> &
  KnownAnnotations

export class ObjectRepresentation implements ValueRepresentation {
  static is(value: object): value is ObjectRepresentation {
    return #value in value
  }

  static unpackAnnotations(annotations: ObjectAnnotations): UnpackedAnnotations {
    const {
      a: isArrayLike = false,
      c: constructorName,
      l: length,
      n: isNullProto = false,
      o: isObjectProto = false,
      p: pointer,
      q: constructorNameAndStringTag,
      t: stringTag,
    } = annotations
    return {
      isArrayLike,
      constructorName: constructorNameAndStringTag ?? constructorName,
      length,
      isNullProto,
      isObjectProto,
      pointer,
      stringTag: constructorNameAndStringTag ?? stringTag,
    }
  }

  static deserialize(context: DeserializationContext, decoder: Decoder) {
    return new this(context, this.unpackAnnotations(decoder.annotations<ObjectAnnotations>()))
  }

  readonly #value: object
  readonly #context: Context

  constructor(context: Context, value: object) {
    this.#value = value
    this.#context = context
  }

  get pointer(): number {
    return this.#context.pointer(this, this.#value) ?? never()
  }

  compare(other: ValueRepresentation): Comparison {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual

    // Allow either value to have a null prototype so such objects can be compared against literals.
    if (
      (this.#context.isNullProto(this.#value) && other.#context.isObjectProto(other.#value)) ||
      (this.#context.isObjectProto(this.#value) && other.#context.isNullProto(other.#value))
    ) {
      return comparable
    }

    if (this.#context.stringTag(this.#value) !== other.#context.stringTag(other.#value)) return unequal
    if (this.#context.constructorName(this.#value) !== other.#context.constructorName(other.#value)) return unequal

    return comparable
  }

  *[Symbol.iterator](): IterableIterator<ValueRepresentation> {
    yield* this.iterateArrayLike()
    yield* this.iterateProperties()
    yield* this.iterateIterable()
  }

  *iterateArrayLike(): IterableIterator<ElementAccessor> {
    if (!this.#context.isArrayLike(this.#value)) {
      return
    }

    yield* this.#context.iterateElements(this.#value)
  }

  *iterateProperties(...include: string[]): IterableIterator<PropertyGroup> {
    const namedProperties = this.#context.namedProperties(this.#value, ...include)
    if (!namedProperties.empty) yield namedProperties
    const symbolProperties = this.#context.symbolProperties(this.#value)
    if (!symbolProperties.empty) yield symbolProperties
  }

  *iterateIterable(): IterableIterator<IteratorValueAccessor | MapEntryAccessor> {
    if (this.#context.isArrayLike(this.#value)) {
      return
    }

    yield* this.#context.iterateValues(this.#value)
  }

  serialize(
    encoder: Encoder,
    staticType: StaticType = staticTypeTable.object,
    annotations: SerializationAnnotations = {},
  ): SerializationResult {
    type Annotations = {
      [K in keyof SerializationAnnotations]: K extends keyof ObjectAnnotations
        ? ObjectAnnotations[K] | undefined
        : SerializationAnnotations[K] | undefined
    }

    // Pack annotations such that recurring values have a stable prefix, which can be used to optimize compression.
    //
    // Note that the encoder elides undefined values.
    const a = annotations.b ? undefined : this.#context.isArrayLike(this.#value) || undefined
    const c = this.#context.constructorName(this.#value)
    const t = this.#context.stringTag(this.#value)
    const q = c === t ? c : undefined

    encoder.staticType(staticType).annotations({
      c: q === undefined ? c : undefined,
      t: q === undefined ? t : undefined,
      q,
      n: this.#context.isNullProto(this.#value) || undefined,
      o: this.#context.isObjectProto(this.#value) || undefined,
      a,
      // Only insert annotations from the calling code here; they technically could override other properties but the
      // types disallow that. Calling code should take care to order annotations so contribute to the stable
      // prefix.
      ...annotations,
      p: this.pointer, // Different for most values, so the stable prefix ends after the `p` property.
      l: a && this.#context.length(this.#value),
    } as Annotations)
    return partialRequiringTerminator
  }
}
