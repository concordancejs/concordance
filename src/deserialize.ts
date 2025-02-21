import assert from 'node:assert'
import type { DecodeOptions as Cbor2DecodeOptions } from 'cbor2'
import { Sequence, type Tuple } from 'cbor2/decoder'
import never from 'never'
import {
  version as expectedVersion,
  type AspectType,
  type StaticType,
  isValidAspectType,
  isValidStaticType,
  staticTypeTable,
} from './serialization-types.ts'
import type { ValueRepresentation } from './value.js'
import type { Context } from './context.js'
import { BigIntRepresentation } from './values/primitives/bigint.ts'
import { BooleanRepresentation } from './values/primitives/boolean.ts'
import { NullRepresentation } from './values/primitives/null.ts'
import { NumberRepresentation } from './values/primitives/number.ts'
import { StringRepresentation } from './values/primitives/string.ts'
import { UndefinedRepresentation } from './values/primitives/undefined.ts'
import { SymbolRepresentation } from './values/primitives/symbol.ts'
import { BytesAccessor } from './accessors/bytes.ts'
import { ObjectRepresentation } from './values/objects/object.ts'
import { ArrayRepresentation } from './values/objects/array.ts' // eslint-disable-line import/no-cycle
import { MapRepresentation } from './values/objects/map.ts'
import { SetRepresentation } from './values/objects/set.ts'
import { ArrayBufferViewRepresentation } from './values/objects/array-buffer-view.ts'
import { DateRepresentation } from './values/objects/date.ts'
import { RegExpRepresentation } from './values/objects/regexp.ts'
import { ErrorRepresentation } from './values/objects/error.ts'
import { ArgumentsRepresentation } from './values/objects/arguments.ts'
import { ArrayBufferRepresentation } from './values/objects/array-buffer.ts'
import { BoxedPrimitiveRepresentation } from './values/objects/boxed.ts'
import { CryptoKeyRepresentation } from './values/web/crypto-key.ts'
import { ExternalRepresentation } from './values/nodejs/external.ts'
import { FunctionRepresentation } from './values/objects/function.ts'
import { ModuleNamespaceObjectRepresentation } from './values/objects/module-namespace-object.ts'
import { PromiseRepresentation } from './values/objects/promise.ts'
import { WeakMapRepresentation } from './values/objects/weak-map.ts'
import { WeakSetRepresentation } from './values/objects/weak-set.ts'
import { ElementAccessor, SparseValueRepresentation } from './accessors/element.ts'
// eslint-disable-next-line import/no-cycle
import {
  NamedPropertyAccessor,
  NamedPropertyGroup,
  SymbolPropertyAccessor,
  SymbolPropertyGroup,
} from './accessors/property.ts'
import { MapEntryAccessor } from './accessors/map-entry.ts' // eslint-disable-line import/no-cycle
import { IteratorValueAccessor } from './accessors/iterator-value.ts'

export class Decoder {
  readonly #sequence: Sequence
  readonly #options: Cbor2DecodeOptions = {
    cde: false,
    dcbor: false,
    rejectBigInts: false,
    rejectDuplicateKeys: false,
    rejectFloats: false,
    rejectUndefined: false,
    sortKeys: null,
  }

  constructor(bytes: Uint8Array) {
    this.#sequence = new Sequence(bytes, this.#options)
  }

  *[Symbol.iterator](): IterableIterator<Tuple> {
    yield* this.#sequence
  }

  int(): number {
    const [majorType, _, value] = this.#sequence.read() ?? never()
    if (majorType === 0 || majorType === 1) {
      if (typeof value === 'bigint') {
        return never('Unexpected bigint')
      }

      return value as number
    }

    return never(`Expected an integer, got major type ${majorType}`)
  }

  peekStaticType(): StaticType | undefined {
    const boo = this.#sequence.peek()
    if (!boo) return

    const [majorType, _, value] = boo
    if (majorType !== 0) return

    const type = value as number
    return isValidStaticType(type) ? type : undefined
  }

  staticType(): StaticType | undefined {
    if (!this.#sequence.peek()) return

    const type = this.int()
    return isValidStaticType(type) ? type : never(`Invalid static type: ${type}`)
  }

  aspectType(): AspectType | undefined {
    if (!this.#sequence.peek()) return

    const type = this.int()
    return isValidAspectType(type) ? type : never(`Invalid aspect type: ${type}`)
  }

  bigInt(): bigint {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType === 0 || majorType === 1) {
      if (typeof value === 'number') {
        return BigInt(value)
      }

      return value as bigint
    }

    // TODO: Handle tagged bignums.

    return never(`Expected a bigint, got ${majorType} with additional information ${additionalInformation}`)
  }

  boolean(): boolean {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType === 7 && (additionalInformation === 20 || additionalInformation === 21)) {
      return value as boolean
    }

    return never(`Expected a boolean, got major type ${majorType} with additional information ${additionalInformation}`)
  }

  number(): number {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType === 0 || majorType === 1) {
      if (typeof value === 'bigint') {
        return never('Unexpected bigint')
      }

      return value as number
    }

    if (
      majorType === 7 &&
      (additionalInformation === 25 || additionalInformation === 26 || additionalInformation === 27)
    ) {
      return value as number
    }

    return never(`Expected a number, got major type ${majorType} with additional information ${additionalInformation}`)
  }

  string(): string {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType === 3 && additionalInformation !== 31) {
      return value as string
    }

    return never(
      `Expected a fixed-length text string, got major type ${majorType} with additional information ${additionalInformation}`,
    )
  }

  uint8Array(): Uint8Array {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType === 2 && additionalInformation !== 31) {
      return value as Uint8Array
    }

    return never(
      `Expected a fixed-length byte string, got major type ${majorType} with additional information ${additionalInformation}`,
    )
  }

  annotations<T extends Record<string, boolean | number | string | BytesAccessor>>(): T {
    const [majorType, additionalInformation, value] = this.#sequence.read() ?? never()
    if (majorType !== 5 || additionalInformation === 31) {
      return never(
        `Expected a map with defined length, got major type ${majorType} with additional information ${additionalInformation}`,
      )
    }

    const result = {} as unknown as T
    const length = value as number
    for (let i = 0; i < length; i++) {
      const key = this.string() as keyof T
      const [majorType, additionalInformation] = this.#sequence.peek() ?? never()
      let value
      switch (majorType) {
        case 0:
        case 1: {
          value = this.number()
          break
        }

        case 2: {
          const bytes = this.uint8Array()
          value = new BytesAccessor(bytes.buffer, bytes.byteOffset, bytes.byteLength)
          break
        }

        case 3: {
          value = this.string()
          break
        }

        case 7: {
          if (additionalInformation === 20 || additionalInformation === 21) {
            value = this.boolean()
          } else if (additionalInformation === 25 || additionalInformation === 26 || additionalInformation === 27) {
            value = this.number()
          }

          break
        }

        default: {
          return never(`Unexpected major type ${majorType}`)
        }
      }

      result[key] = (value as T[keyof T]) ?? never()
    }

    return result
  }
}

class PointerMap extends Map<number, ValueRepresentation> {
  readonly #byRepresentation = new WeakMap<ValueRepresentation, number>()

  getIndex(key: ValueRepresentation): number | undefined {
    return this.#byRepresentation.get(key)
  }

  override set(key: number, value: ValueRepresentation): this {
    this.#byRepresentation.set(value, key)
    return super.set(key, value)
  }
}

class IterationState {
  #elementAccessors: ElementAccessor[] | undefined
  #mapEntryAccessors: MapEntryAccessor[] | undefined
  #namedPropertyGroup: NamedPropertyGroup | undefined
  #namedPropertyAccessors: NamedPropertyAccessor[] | undefined
  #symbolPropertyGroup: SymbolPropertyGroup | undefined
  #valueAccessors: IteratorValueAccessor[] | undefined
  #lastAspect?: AspectType
  #terminated = false

  get elementAccessors() {
    return this.#elementAccessors
  }

  get mapEntryAccessors() {
    return this.#mapEntryAccessors
  }

  get namedPropertyAccessors() {
    return this.#namedPropertyAccessors
  }

  get namedPropertyGroup(): NamedPropertyGroup | undefined {
    return this.#namedPropertyGroup
  }

  set namedPropertyGroup(value: NamedPropertyGroup) {
    this.#namedPropertyGroup = value
  }

  get symbolPropertyGroup(): SymbolPropertyGroup | undefined {
    return this.#symbolPropertyGroup
  }

  set symbolPropertyGroup(value: SymbolPropertyGroup) {
    this.#symbolPropertyGroup = value
  }

  get valueAccessors() {
    return this.#valueAccessors
  }

  get lastAspect(): AspectType | undefined {
    return this.#lastAspect
  }

  set lastAspect(value: AspectType) {
    this.#lastAspect = value
  }

  get terminated() {
    return this.#terminated
  }

  terminate() {
    this.#terminated = true
  }

  addElementAccessor(accessor: ElementAccessor): ElementAccessor {
    this.#elementAccessors ??= []
    this.#elementAccessors.push(accessor)
    return accessor
  }

  addMapEntryAccessor(accessor: MapEntryAccessor): MapEntryAccessor {
    this.#mapEntryAccessors ??= []
    this.#mapEntryAccessors.push(accessor)
    return accessor
  }

  addNamedPropertyAccessor(accessor: NamedPropertyAccessor): NamedPropertyAccessor {
    this.#namedPropertyAccessors ??= []
    this.#namedPropertyAccessors.push(accessor)
    return accessor
  }

  addValueAccessor(accessor: IteratorValueAccessor): IteratorValueAccessor {
    this.#valueAccessors ??= []
    this.#valueAccessors.push(accessor)
    return accessor
  }
}

export class DeserializationContext implements Context {
  static is(context: Context): context is DeserializationContext {
    return #decoder in context
  }

  readonly #decoder: Decoder
  readonly #iterationStates = new WeakMap<object, IterationState>()
  readonly #pointers = new PointerMap()

  constructor(decoder: Decoder) {
    this.#decoder = decoder
  }

  get deserialized() {
    return true
  }

  // eslint-disable-next-line complexity
  next(): ValueRepresentation | undefined {
    let representation: ValueRepresentation
    switch (this.#decoder.staticType()) {
      case undefined: {
        return
      }

      case staticTypeTable.terminator:
      case staticTypeTable.elementAspect:
      case staticTypeTable.iteratorValueAspect:
      case staticTypeTable.mapEntryAspect:
      case staticTypeTable.namedPropertyAspect:
      case staticTypeTable.symbolPropertyAspect: {
        return never('Unexpected terminator or aspect')
      }

      case staticTypeTable.pointer: {
        const pointer = this.#decoder.int()
        return this.#pointers.get(pointer) ?? never(`Unknown pointer: ${pointer}`)
      }

      case staticTypeTable.bigint: {
        representation = BigIntRepresentation.deserialize(this.#decoder)
        break
      }

      case staticTypeTable.boolean: {
        representation = BooleanRepresentation.deserialize(this.#decoder)
        break
      }

      case staticTypeTable.null: {
        representation = new NullRepresentation()
        break
      }

      case staticTypeTable.number: {
        representation = NumberRepresentation.deserialize(this.#decoder)
        break
      }

      case staticTypeTable.string: {
        representation = StringRepresentation.deserialize(this.#decoder)
        break
      }

      case staticTypeTable.symbol: {
        representation = SymbolRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.undefined: {
        representation = new UndefinedRepresentation()
        break
      }

      case staticTypeTable.object: {
        representation = ObjectRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.array: {
        representation = ArrayRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.map: {
        representation = MapRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.set: {
        representation = SetRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.arrayBufferView: {
        representation = ArrayBufferViewRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.date: {
        representation = DateRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.regExp: {
        representation = RegExpRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.error: {
        representation = ErrorRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.arguments: {
        representation = ArgumentsRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.arrayBuffer: {
        representation = ArrayBufferRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.boxedPrimitive: {
        representation = BoxedPrimitiveRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.cryptoKey: {
        representation = CryptoKeyRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.external: {
        representation = ExternalRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.function: {
        representation = FunctionRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.moduleNamespaceObject: {
        representation = ModuleNamespaceObjectRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.promise: {
        representation = PromiseRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.weakMap: {
        representation = WeakMapRepresentation.deserialize(this, this.#decoder)
        break
      }

      case staticTypeTable.weakSet: {
        representation = WeakSetRepresentation.deserialize(this, this.#decoder)
        break
      }
    }

    if (representation.pointer !== undefined) {
      this.#pointers.set(representation.pointer, representation)
    }

    return representation
  }

  constructorName(value: object): string | undefined {
    return (value as { constructorName?: string }).constructorName
  }

  describeSymbol(value: object): { key?: string; wellKnown?: string; string?: string } {
    return value as { key?: string; wellKnown?: string; string?: string }
  }

  isArrayLike(value: object): boolean {
    return (value as { isArrayLike: boolean }).isArrayLike
  }

  isNullProto(value: object): boolean {
    return (value as { isNullProto: boolean }).isNullProto
  }

  isObjectProto(value: object): boolean {
    return (value as { isObjectProto: boolean }).isObjectProto
  }

  *iterateElements(value: object): Iterable<ElementAccessor> {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.elementAccessors) {
      yield* state.elementAccessors
    }

    if (state.terminated) return

    let endedAspect = false
    let index = state.elementAccessors?.length ?? 0
    do {
      switch (this.#decoder.peekStaticType()) {
        case staticTypeTable.terminator: {
          this.#decoder.staticType()
          state.terminate()
          break
        }

        case staticTypeTable.iteratorValueAspect:
        case staticTypeTable.mapEntryAspect:
        case staticTypeTable.namedPropertyAspect:
        case staticTypeTable.symbolPropertyAspect: {
          endedAspect = true
          break
        }

        case staticTypeTable.elementAspect: {
          state.lastAspect = this.#decoder.aspectType() ?? never()
          break
        }

        case staticTypeTable.undefined: {
          assert(state.lastAspect === staticTypeTable.elementAspect, 'Unexpected undefined')
          this.#decoder.staticType()
          yield state.addElementAccessor(new ElementAccessor(index++, new SparseValueRepresentation()))
          break
        }

        default: {
          assert(state.lastAspect === staticTypeTable.elementAspect, 'Unexpected value')
          const representation = this.next() ?? never('No value was deserialized')
          yield state.addElementAccessor(new ElementAccessor(index++, representation))
        }
      }
    } while (!state.terminated && state.lastAspect === staticTypeTable.elementAspect && !endedAspect)
  }

  *iterateNamedProperties(value: NamedPropertyGroup): Iterable<NamedPropertyAccessor> {
    const state = this.#iterationStates.get(value) ?? never('Unknown named property group')
    if (state.namedPropertyAccessors) {
      yield* state.namedPropertyAccessors
    }

    let endedAspect = false
    while (!state.terminated && state.lastAspect === staticTypeTable.namedPropertyAspect && !endedAspect) {
      switch (this.#decoder.peekStaticType()) {
        case staticTypeTable.terminator: {
          this.#decoder.staticType()
          state.terminate()
          break
        }

        case staticTypeTable.elementAspect:
        case staticTypeTable.iteratorValueAspect:
        case staticTypeTable.mapEntryAspect:
        case staticTypeTable.namedPropertyAspect:
        case staticTypeTable.symbolPropertyAspect: {
          endedAspect = true
          break
        }

        // Named properties are encoded as a sequence of CBOR strings and serialized values.
        case undefined: {
          assert(state.lastAspect === staticTypeTable.namedPropertyAspect, 'Unexpected undefined')
          const key = this.#decoder.string()
          const value = this.next() ?? never('No value was deserialized')
          yield state.addNamedPropertyAccessor(new NamedPropertyAccessor(key, value))
          break
        }

        default: {
          never(`Unexpected static type ${this.#decoder.peekStaticType()}`)
        }
      }
    }
  }

  *iterateMapEntries(value: object): Iterable<MapEntryAccessor> {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.mapEntryAccessors) {
      yield* state.mapEntryAccessors
    }

    if (state.terminated) return

    let endedAspect = false
    do {
      switch (this.#decoder.peekStaticType()) {
        case staticTypeTable.terminator: {
          this.#decoder.staticType()
          state.terminate()
          break
        }

        case staticTypeTable.elementAspect:
        case staticTypeTable.iteratorValueAspect:
        case staticTypeTable.namedPropertyAspect:
        case staticTypeTable.symbolPropertyAspect: {
          endedAspect = true
          break
        }

        case staticTypeTable.mapEntryAspect: {
          state.lastAspect = this.#decoder.aspectType() ?? never()
          break
        }

        default: {
          assert(state.lastAspect === staticTypeTable.mapEntryAspect, 'Unexpected value')
          const key = this.next() ?? never('No key was deserialized')
          yield state.addMapEntryAccessor(new MapEntryAccessor(this, key))
        }
      }
    } while (!state.terminated && state.lastAspect === staticTypeTable.mapEntryAspect && !endedAspect)
  }

  *iterateValues(value: object): Iterable<IteratorValueAccessor> {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.valueAccessors) {
      yield* state.valueAccessors
    }

    if (state.terminated) return

    let endedAspect = false
    let index = state.valueAccessors?.length ?? 0
    do {
      switch (this.#decoder.peekStaticType()) {
        case staticTypeTable.terminator: {
          this.#decoder.staticType()
          state.terminate()
          break
        }

        case staticTypeTable.elementAspect:
        case staticTypeTable.mapEntryAspect:
        case staticTypeTable.namedPropertyAspect:
        case staticTypeTable.symbolPropertyAspect: {
          endedAspect = true
          break
        }

        case staticTypeTable.iteratorValueAspect: {
          state.lastAspect = this.#decoder.aspectType() ?? never()
          break
        }

        default: {
          assert(state.lastAspect === staticTypeTable.iteratorValueAspect, 'Unexpected value')
          yield state.addValueAccessor(
            new IteratorValueAccessor(index++, this.next() ?? never('No value was deserialized')),
          )
        }
      }
    } while (!state.terminated && state.lastAspect === staticTypeTable.iteratorValueAspect && !endedAspect)
  }

  namedProperties(value: object): NamedPropertyGroup {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.terminated) {
      state.namedPropertyGroup ??= new NamedPropertyGroup(this, [])
    }

    if (state.namedPropertyGroup) {
      return state.namedPropertyGroup
    }

    let endedAspect = false
    do {
      switch (this.#decoder.peekStaticType()) {
        case staticTypeTable.terminator: {
          this.#decoder.staticType()
          state.terminate()
          break
        }

        case staticTypeTable.elementAspect:
        case staticTypeTable.iteratorValueAspect:
        case staticTypeTable.mapEntryAspect:
        case staticTypeTable.symbolPropertyAspect: {
          endedAspect = true
          break
        }

        case staticTypeTable.namedPropertyAspect: {
          state.lastAspect = this.#decoder.aspectType() ?? never()
          break
        }

        // Named properties are encoded as a sequence of CBOR strings and serialized values.
        case undefined: {
          assert(state.lastAspect === staticTypeTable.namedPropertyAspect, 'Unexpected non-static type')
          const key = this.#decoder.string()
          const value = this.next() ?? never('No value was deserialized')
          const firstProperty = new NamedPropertyAccessor(key, value)
          state.addNamedPropertyAccessor(firstProperty)
          state.namedPropertyGroup = new NamedPropertyGroup(this, [firstProperty])
          this.#iterationStates.set(state.namedPropertyGroup, state)
          break
        }

        default: {
          never(`Unexpected static type ${this.#decoder.peekStaticType()}`)
        }
      }
    } while (
      !state.terminated &&
      !state.namedPropertyGroup &&
      state.lastAspect === staticTypeTable.namedPropertyAspect &&
      !endedAspect
    )

    state.namedPropertyGroup ??= new NamedPropertyGroup(this, [])
    return state.namedPropertyGroup
  }

  symbolProperties(value: object): SymbolPropertyGroup {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.terminated) {
      state.symbolPropertyGroup ??= new SymbolPropertyGroup([])
    }

    if (state.symbolPropertyGroup) {
      return state.symbolPropertyGroup
    }

    let endedAspect = false
    const properties: SymbolPropertyAccessor[] = []
    do {
      switch (this.#decoder.peekStaticType()) {
        case staticTypeTable.terminator: {
          this.#decoder.staticType()
          state.terminate()
          break
        }

        case staticTypeTable.elementAspect:
        case staticTypeTable.iteratorValueAspect:
        case staticTypeTable.mapEntryAspect:
        case staticTypeTable.namedPropertyAspect: {
          endedAspect = true
          break
        }

        case staticTypeTable.symbolPropertyAspect: {
          state.lastAspect = this.#decoder.aspectType() ?? never()
          break
        }

        case staticTypeTable.symbol: {
          assert(state.lastAspect === staticTypeTable.symbolPropertyAspect, 'Unexpected symbol')
          this.#decoder.staticType()
          const key = SymbolRepresentation.deserialize(this, this.#decoder)
          const value = this.#decoder.uint8Array()
          const decoder = new Decoder(value)
          const context = new DeserializationContext(decoder)
          properties.push(new SymbolPropertyAccessor(context, key))
          break
        }

        default: {
          never(`Unexpected static type ${this.#decoder.peekStaticType()}`)
        }
      }
    } while (!state.terminated && state.lastAspect === staticTypeTable.symbolPropertyAspect && !endedAspect)

    state.symbolPropertyGroup = new SymbolPropertyGroup(properties)
    return state.symbolPropertyGroup
  }

  length(value: object): number {
    return (value as { length: number }).length
  }

  pointer(_: ValueRepresentation, value: object): number | undefined {
    return (value as { pointer?: number }).pointer
  }

  representBytes(value: object): BytesAccessor {
    return (value as { bytes: BytesAccessor }).bytes
  }

  size(value: object): number {
    return (value as { size: number }).size
  }

  stringTag(value: object): string | undefined {
    return (value as { stringTag?: string }).stringTag
  }

  valueOf(value: object): unknown {
    return (value as { valueOf: unknown }).valueOf
  }
}

export class UnsupportedVersion extends Error {
  readonly serializerVersion: number

  constructor(serializerVersion: number) {
    super('Could not deserialize buffer: a different serialization was expected')
    this.serializerVersion = serializerVersion
  }

  override get name() {
    return 'UnsupportedVersion'
  }
}

export function deserialize(bytes: Uint8Array): ValueRepresentation {
  const decoder = new Decoder(bytes)
  const version = decoder.int()
  if (version !== expectedVersion) throw new UnsupportedVersion(version)

  return new DeserializationContext(decoder).next() ?? never('No value was deserialized')
}
