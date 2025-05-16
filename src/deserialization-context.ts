import assert from 'node:assert'
import never from 'never'
import { type AspectType, staticTypeTable } from './serialization-types.ts'
import type { ValueRepresentation } from './value.js'
import type { Context } from './context.js'
import { BigIntRepresentation } from './values/primitives/bigint.ts'
import { BooleanRepresentation } from './values/primitives/boolean.ts'
import { NullRepresentation } from './values/primitives/null.ts'
import { NumberRepresentation } from './values/primitives/number.ts'
import { StringRepresentation } from './values/primitives/string.ts'
import { UndefinedRepresentation } from './values/primitives/undefined.ts'
import { SymbolRepresentation } from './values/primitives/symbol.ts'
import type { BytesAccessor } from './accessors/bytes.ts'
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
import { Decoder } from './decoder.ts'

class PointerMap extends Map<number, ValueRepresentation> {
  readonly #byRepresentation = new WeakMap<ValueRepresentation, number>()

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

  *iterateElements(value: object): IterableIterator<ElementAccessor> {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.elementAccessors) {
      yield* state.elementAccessors
    }

    if (state.terminated) return

    let endedAspect = false
    let index = state.elementAccessors?.length ?? 0
    do {
      switch (this.#decoder.peekStaticType() ?? never('Expected terminator, aspect or value')) {
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
          assert(state.lastAspect === staticTypeTable.elementAspect, 'Expected terminator or aspect')
          const representation = this.next() ?? never()
          yield state.addElementAccessor(new ElementAccessor(index++, representation))
        }
      }
    } while (!state.terminated && state.lastAspect === staticTypeTable.elementAspect && !endedAspect)
  }

  *iterateNamedProperties(value: NamedPropertyGroup): IterableIterator<NamedPropertyAccessor> {
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
        case staticTypeTable.symbolPropertyAspect: {
          endedAspect = true
          break
        }

        // For concistency with other iterators, we allow named property aspects to be repeated.
        case staticTypeTable.namedPropertyAspect: {
          this.#decoder.aspectType()
          continue
        }

        // Named properties are encoded as a sequence of CBOR strings and serialized values.
        case undefined: {
          assert(state.lastAspect === staticTypeTable.namedPropertyAspect, 'Expected terminator or aspect')
          assert(this.#decoder.hasNext(), 'Expected property name')
          const key = this.#decoder.string()
          const value = this.next() ?? never('Expected value after property name')
          yield state.addNamedPropertyAccessor(new NamedPropertyAccessor(key, value))
          break
        }

        default: {
          never(`Unexpected static type ${this.#decoder.peekStaticType()}`)
        }
      }
    }
  }

  *iterateMapEntries(value: object): IterableIterator<MapEntryAccessor> {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.mapEntryAccessors) {
      yield* state.mapEntryAccessors
    }

    if (state.terminated) return

    let endedAspect = false
    do {
      switch (this.#decoder.peekStaticType() ?? never('Expected terminator, aspect or key')) {
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
          assert(state.lastAspect === staticTypeTable.mapEntryAspect, 'Expected terminator or aspect')
          const key = this.next() ?? never()
          yield state.addMapEntryAccessor(new MapEntryAccessor(this, key))
        }
      }
    } while (!state.terminated && state.lastAspect === staticTypeTable.mapEntryAspect && !endedAspect)
  }

  *iterateValues(value: object): IterableIterator<IteratorValueAccessor> {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.valueAccessors) {
      yield* state.valueAccessors
    }

    if (state.terminated) return

    let endedAspect = false
    let index = state.valueAccessors?.length ?? 0
    do {
      switch (this.#decoder.peekStaticType() ?? never('Expected terminator, aspect or value')) {
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
          assert(state.lastAspect === staticTypeTable.iteratorValueAspect, 'Expected terminator or aspect')
          const value = this.next() ?? never()
          yield state.addValueAccessor(new IteratorValueAccessor(index++, value))
        }
      }
    } while (!state.terminated && state.lastAspect === staticTypeTable.iteratorValueAspect && !endedAspect)
  }

  namedProperties(value: object): NamedPropertyGroup {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.terminated) {
      state.namedPropertyGroup ??= new NamedPropertyGroup(this, [])
      this.#iterationStates.set(state.namedPropertyGroup, state)
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
          assert(state.lastAspect === staticTypeTable.namedPropertyAspect, 'Expected terminator or aspect')
          assert(this.#decoder.hasNext(), 'Expected property name')
          const key = this.#decoder.string()
          const value = this.next() ?? never('Expected value after property name')
          const firstProperty = new NamedPropertyAccessor(key, value)
          state.addNamedPropertyAccessor(firstProperty)
          state.namedPropertyGroup = new NamedPropertyGroup(this, [firstProperty])
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
    this.#iterationStates.set(state.namedPropertyGroup, state)
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
      switch (this.#decoder.peekStaticType() ?? never('Expected terminator, aspect or property')) {
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
          assert(state.lastAspect === staticTypeTable.symbolPropertyAspect, 'Expected terminater or aspect')
          assert(this.#decoder.hasNext(), 'Expected property symbol')
          this.#decoder.staticType()
          const key = SymbolRepresentation.deserialize(this, this.#decoder)
          assert(this.#decoder.hasNext(), 'Expected value after property symbol')
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
