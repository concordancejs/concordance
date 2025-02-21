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
  c?: string // Constructor name
  l?: number // Length of array-like
  n?: true // Has null prototype
  o?: true // Has object prototype
  p: number // Pointer
  t?: string // String tag
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

type Reserved<T> = { [K in keyof Required<T>]?: undefined }

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
      t: stringTag,
    } = annotations
    return {
      isArrayLike,
      constructorName,
      length,
      isNullProto,
      isObjectProto,
      pointer,
      stringTag,
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

    const a = annotations.b ? undefined : this.#context.isArrayLike(this.#value) || undefined
    encoder.staticType(staticType).annotations<Annotations>({
      ...annotations,
      a,
      c: this.#context.constructorName(this.#value),
      l: a && this.#context.length(this.#value),
      n: this.#context.isNullProto(this.#value) || undefined,
      o: this.#context.isObjectProto(this.#value) || undefined,
      p: this.pointer,
      t: this.#context.stringTag(this.#value),
    })
    return partialRequiringTerminator
  }
}
