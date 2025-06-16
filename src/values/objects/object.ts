import never from 'never'
import type {
  FinalFormatOptions,
  CommonRepresentation,
  DeepFunctionality,
  ValueRepresentation,
  Opaque,
} from '../../value.d.ts'
import type { ElementAccessor } from '../../accessors/element.ts'
import type { IteratorValueAccessor } from '../../accessors/iterator-value.ts'
import type { MapEntryAccessor } from '../../accessors/map-entry.ts'
import { type Comparison, type Mode, comparable, strictlyEqual, unequal } from '../../comparison.ts'
import type { Context } from '../../context.d.ts'
import type { BytesAccessor } from '../../accessors/bytes.ts'
import type { Annotations, Encoder } from '../../encoder.ts'
import { staticTypeTable, type StaticType } from '../../serialization-types.ts'
import { partialRequiringTerminator, type SerializationResult } from '../../serialization-result.ts'
import type { Decoder } from '../../decoder.ts'
import type { DeserializationContext } from '../../deserialization-context.ts'
import { Formatter } from '../../formatter.ts'

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

export type SerializationAnnotations = Annotations & Reserved<ObjectAnnotations> & KnownAnnotations

export class ObjectRepresentation implements CommonRepresentation, DeepFunctionality {
  static is(value: Opaque): value is ObjectRepresentation {
    return #value in value
  }

  static isPlain(value: Opaque): value is ObjectRepresentation {
    if (!(#value in value)) return false

    const context = value.#context
    const opaque = value.#value
    return (
      !context.isNullProto(opaque) &&
      context.constructorName(opaque) === 'Object' &&
      context.stringTag(opaque) === undefined
    )
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

  readonly #value: Opaque
  readonly #context: Context

  constructor(context: Context, value: Opaque) {
    this.#value = value
    this.#context = context
  }

  get deserialized() {
    return this.#context.deserialized
  }

  get pointer(): number {
    return this.#context.pointer(this, this.#value) ?? never()
  }

  compare(other: ValueRepresentation, mode: Mode): Comparison {
    if (!(#value in other)) return unequal
    if (this.#value === other.#value) return strictlyEqual

    if (mode === 'fuzzy') {
      // Allow *only* array-like objects to be compared against ArrayRepresentation
      if (other.constructor.name === 'ArrayRepresentation') {
        return this.#context.isArrayLike(this.#value) ? comparable : unequal
      }

      // Do not compare constructor name, string tag or prototype when doing fuzzy comparisons.
      return comparable
    }

    // Allow either value to have a null prototype so such objects can be compared against literals.
    if (
      this.#context.flags.compareNullProtoToObjectProto &&
      ((this.#context.isNullProto(this.#value) && other.#context.isObjectProto(other.#value)) ||
        (this.#context.isObjectProto(this.#value) && other.#context.isNullProto(other.#value)))
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

  *iterateProperties(excludeInclude?: {
    exclude?: string[]
    include?: string[]
  }): IterableIterator<ValueRepresentation> {
    yield* this.#context.namedProperties(this.#value, excludeInclude)
    yield* this.#context.symbolProperties(this.#value)
  }

  *iterateIterable(): IterableIterator<IteratorValueAccessor | MapEntryAccessor> {
    if (this.#context.isArrayLike(this.#value)) {
      return
    }

    yield* this.#context.iterateValues(this.#value)
  }

  // eslint-disable-next-line complexity
  finalFormat(formatter: Formatter, options?: FinalFormatOptions): void {
    const constructorName = this.#context.constructorName(this.#value)
    const { empty, maxDepthReached } = formatter
    const stringTag = this.#context.stringTag(this.#value)
    const isNullProto = this.#context.isNullProto(this.#value)
    const asArray = options?.array === true || this.#context.isArrayLike(this.#value)

    const includeConstructorName =
      constructorName !== undefined &&
      ((asArray && constructorName !== 'Array') || (!asArray && constructorName !== 'Object'))

    if (!includeConstructorName && stringTag !== undefined) {
      if (stringTag === '') {
        formatter.prefix(formatter.theme.object.stringTag.empty)
      } else {
        formatter.prefixWrapped('object.stringTag', formatter.encodeTypicalIdentifier(stringTag))
      }

      formatter.prefix(' ')
    } else if (includeConstructorName) {
      if (constructorName === '') {
        formatter.prefix(formatter.theme.object.constructorName.empty)
      } else {
        formatter.prefixWrapped('object.constructorName', formatter.encodeTypicalIdentifier(constructorName))
      }

      formatter.prefix(' ')

      if (stringTag !== undefined && stringTag !== constructorName) {
        if (stringTag === '') {
          formatter.prefix(formatter.theme.object.secondaryStringTag.empty)
        } else {
          formatter.prefixWrapped('object.secondaryStringTag', formatter.encodeTypicalIdentifier(stringTag))
        }

        formatter.prefix(' ')
      }
    }

    if (isNullProto) {
      formatter.prefix(formatter.theme.object.nullPrototype, ' ')
    }

    const bracketKey = asArray ? 'array.bracket' : 'object.bracket'
    if (empty && !maxDepthReached) {
      formatter.prefixWrapped(bracketKey)
    } else {
      formatter.prefix(formatter.theme[bracketKey].open)
      if (maxDepthReached) {
        if (empty) {
          formatter.prefix(` ${formatter.theme.maxDepth} `, formatter.theme[bracketKey].close)
        } else {
          formatter.append(formatter.theme.maxDepth)
        }
      }
    }

    // Regular objects do not require a disambiguation hint, so ignore the `true` value.
    if (typeof options?.disambiguationHint === 'string') {
      formatter.prefix(' ')
      formatter.prefixWrapped('disambiguationHint', options.disambiguationHint)
    }

    if (empty) {
      formatter.close()
    } else {
      formatter.prefix(Formatter.lineMarker).append(Formatter.lineMarker).close(formatter.theme[bracketKey].close)
    }
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

void (ObjectRepresentation satisfies new (
  ...arguments_: ConstructorParameters<typeof ObjectRepresentation>
) => ValueRepresentation)
