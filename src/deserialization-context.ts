import assert from 'node:assert'
import never from 'never'
import { type AspectType, staticTypeTable } from './serialization-types.ts'
import type { Opaque, ValueRepresentation } from './value.d.ts'
import type { Context, ContextOptions, DescribedSymbol, PropertyAccessCallback } from './context.d.ts'
import { BigIntRepresentation } from './values/primitives/bigint.ts'
import { BooleanRepresentation } from './values/primitives/boolean.ts'
import { NullRepresentation } from './values/primitives/null.ts'
import { NumberRepresentation } from './values/primitives/number.ts'
import { StringRepresentation } from './values/primitives/string.ts'
import { UndefinedRepresentation } from './values/primitives/undefined.ts'
import { SymbolRepresentation } from './values/primitives/symbol.ts'
import type { BytesAccessor } from './accessors/bytes.ts'
import { ObjectRepresentation } from './values/objects/object.ts'
import { ArrayRepresentation } from './values/objects/array.ts'
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
import { NamedPropertyAccessor, SymbolPropertyAccessor } from './accessors/property.ts'
import { MapEntryAccessor } from './accessors/map-entry.ts'
import { IteratorValueAccessor } from './accessors/iterator-value.ts'
import { type Decoder } from './decoder.ts'
import { normalizeFlags, type Flags } from './flags.ts'

class PointerMap extends Map<number, ValueRepresentation> {
  readonly #byRepresentation = new WeakMap<ValueRepresentation, number>()

  override set(key: number, value: ValueRepresentation): this {
    this.#byRepresentation.set(value, key)
    return super.set(key, value)
  }
}

class IterationState {
  #elementAccessors: ElementAccessor[] | undefined
  #explicitlyNamedProperties: string[] | undefined
  #mapEntryAccessors: MapEntryAccessor[] | undefined
  #namedPropertyAccessors:
    | Array<{ name: string; accessor: NamedPropertyAccessor; value: ValueRepresentation }>
    | undefined

  #namedPropertyNotifiers: Map<string, { callback: PropertyAccessCallback; invoked: boolean }> | undefined
  #symbolPropertyAccessors: SymbolPropertyAccessor[] | undefined
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
    return this.#namedPropertyAccessors?.map(({ accessor }) => accessor)
  }

  get symbolPropertyAccessors() {
    return this.#symbolPropertyAccessors
  }

  get valueAccessors() {
    return this.#valueAccessors
  }

  // eslint-disable-next-line @typescript-eslint/related-getter-setter-pairs
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

  supportExplicitlyNamedPropertyNotifications(names?: string[]) {
    this.#explicitlyNamedProperties = names
  }

  notifyForCachedNamedProperties() {
    if (!this.#namedPropertyAccessors || !this.#namedPropertyNotifiers || !this.#explicitlyNamedProperties) {
      return
    }

    for (const { name, accessor, value } of this.#namedPropertyAccessors) {
      if (this.#explicitlyNamedProperties.includes(name)) {
        const notifier = this.#namedPropertyNotifiers.get(name)
        if (notifier?.invoked === false) {
          const { callback } = notifier
          callback(accessor, value)
          notifier.invoked = true
        }
      }
    }
  }

  addNamedPropertyAccessor(
    name: string,
    accessor: NamedPropertyAccessor,
    value: ValueRepresentation,
    notify = true,
  ): NamedPropertyAccessor {
    this.#namedPropertyAccessors ??= []
    this.#namedPropertyAccessors.push({ name, accessor, value })
    if (notify && this.#namedPropertyNotifiers && this.#explicitlyNamedProperties?.includes(name)) {
      const notifier = this.#namedPropertyNotifiers.get(name)
      if (notifier?.invoked === false) {
        const { callback } = notifier
        callback(accessor, value)
        notifier.invoked = true
      }
    }

    return accessor
  }

  addNamedPropertyNotifier(name: string, callback: PropertyAccessCallback): void {
    this.#namedPropertyNotifiers ??= new Map<string, { callback: PropertyAccessCallback; invoked: boolean }>()

    // Throw error if a notifier is already registered for this property
    if (this.#namedPropertyNotifiers.has(name)) {
      throw new Error(`A notifier is already registered for property '${name}'`)
    }

    this.#namedPropertyNotifiers.set(name, { callback, invoked: false })
  }

  resetNamedPropertyNotifiers() {
    this.#namedPropertyNotifiers?.clear()
  }

  addSymbolPropertyAccessor(accessor: SymbolPropertyAccessor): SymbolPropertyAccessor {
    this.#symbolPropertyAccessors ??= []
    this.#symbolPropertyAccessors.push(accessor)
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
  readonly #flags: Readonly<Flags>
  readonly #iterationStates = new WeakMap<WeakKey, IterationState>()
  readonly #pointers = new PointerMap()

  constructor(decoder: Decoder, options?: ContextOptions) {
    this.#flags = normalizeFlags(options?.flags)
    this.#decoder = decoder
  }

  get deserialized() {
    return true
  }

  get flags() {
    return this.#flags
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

  constructorName(value: Opaque): string | undefined {
    return (value as { constructorName?: string }).constructorName
  }

  describeSymbol(value: Opaque): DescribedSymbol {
    return value as DescribedSymbol // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
  }

  isArrayLike(value: Opaque): boolean {
    return (value as { isArrayLike: boolean }).isArrayLike // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
  }

  isNullProto(value: Opaque): boolean {
    return (value as { isNullProto: boolean }).isNullProto // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
  }

  isObjectProto(value: Opaque): boolean {
    return (value as { isObjectProto: boolean }).isObjectProto // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
  }

  *iterateElements(value: Opaque): IterableIterator<ElementAccessor> {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.elementAccessors) {
      yield* state.elementAccessors
    }

    if (state.terminated) return

    let endedAspect = false
    let index = state.elementAccessors?.length ?? 0
    do {
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
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
          assert.ok(state.lastAspect === staticTypeTable.elementAspect, 'Unexpected undefined')
          this.#decoder.staticType()
          yield state.addElementAccessor(new ElementAccessor(index++, new SparseValueRepresentation()))
          break
        }

        default: {
          assert.ok(state.lastAspect === staticTypeTable.elementAspect, 'Expected terminator or aspect')
          const representation = this.next() ?? never()
          yield state.addElementAccessor(new ElementAccessor(index++, representation))
        }
      }
    } while (!state.terminated && state.lastAspect === staticTypeTable.elementAspect && !endedAspect)
  }

  *namedProperties(
    value: Opaque,
    excludeInclude?: { exclude?: string[]; include?: string[] },
  ): IterableIterator<NamedPropertyAccessor> {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    state.supportExplicitlyNamedPropertyNotifications(excludeInclude?.include)

    if (state.namedPropertyAccessors) {
      state.notifyForCachedNamedProperties()
      yield* state.namedPropertyAccessors
    }

    if (state.terminated) return

    let endedAspect = false
    do {
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
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
          assert.ok(state.lastAspect === staticTypeTable.namedPropertyAspect, 'Expected terminator or aspect')
          assert.ok(this.#decoder.hasNext(), 'Expected property name')
          const key = this.#decoder.string()
          const value = this.next() ?? never('Expected value after property name')
          yield state.addNamedPropertyAccessor(key, new NamedPropertyAccessor(key, value), value)
          break
        }

        default: {
          never(`Unexpected static type ${this.#decoder.peekStaticType()}`)
        }
      }
    } while (!state.terminated && state.lastAspect === staticTypeTable.namedPropertyAspect && !endedAspect)
  }

  *iterateMapEntries(value: Opaque): IterableIterator<MapEntryAccessor> {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.mapEntryAccessors) {
      yield* state.mapEntryAccessors
    }

    if (state.terminated) return

    let endedAspect = false
    do {
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
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
          assert.ok(state.lastAspect === staticTypeTable.mapEntryAspect, 'Expected terminator or aspect')
          const key = this.next() ?? never()
          yield state.addMapEntryAccessor(new MapEntryAccessor(this, key))
        }
      }
    } while (!state.terminated && state.lastAspect === staticTypeTable.mapEntryAspect && !endedAspect)
  }

  *iterateValues(value: Opaque): IterableIterator<IteratorValueAccessor> {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.valueAccessors) {
      yield* state.valueAccessors
    }

    if (state.terminated) return

    let endedAspect = false
    let index = state.valueAccessors?.length ?? 0
    do {
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
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
          assert.ok(state.lastAspect === staticTypeTable.iteratorValueAspect, 'Expected terminator or aspect')
          const value = this.next() ?? never()
          yield state.addValueAccessor(new IteratorValueAccessor(index++, value))
        }
      }
    } while (!state.terminated && state.lastAspect === staticTypeTable.iteratorValueAspect && !endedAspect)
  }

  notifyNextExplicitlyNamedPropertyAccess(value: Opaque, name: string, callback: PropertyAccessCallback) {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    state.addNamedPropertyNotifier(name, callback)
  }

  resetPropertyAccessNotifiers(value: Opaque) {
    const state = this.#iterationStates.get(value)
    state?.resetNamedPropertyNotifiers()
  }

  *symbolProperties(value: Opaque): IterableIterator<SymbolPropertyAccessor> {
    const state = this.#iterationStates.get(value) ?? new IterationState()
    this.#iterationStates.set(value, state)

    if (state.symbolPropertyAccessors) {
      yield* state.symbolPropertyAccessors
    }

    if (state.terminated) return

    let endedAspect = false
    do {
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
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
          assert.ok(state.lastAspect === staticTypeTable.symbolPropertyAspect, 'Expected terminater or aspect')
          assert.ok(this.#decoder.hasNext(), 'Expected property symbol')
          this.#decoder.staticType()
          const key = SymbolRepresentation.deserialize(this, this.#decoder)
          assert.ok(this.#decoder.hasNext(), 'Expected value after property symbol')
          const value = this.next() ?? never('Expected value after property symbol')
          yield state.addSymbolPropertyAccessor(new SymbolPropertyAccessor(key, value))
          break
        }

        default: {
          never(`Unexpected static type ${this.#decoder.peekStaticType()}`)
        }
      }
    } while (!state.terminated && state.lastAspect === staticTypeTable.symbolPropertyAspect && !endedAspect)
  }

  length(value: Opaque): number {
    return (value as { length: number }).length // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
  }

  pointer(_: ValueRepresentation, value: Opaque): number | undefined {
    return (value as { pointer?: number }).pointer
  }

  representBytes(value: Opaque): BytesAccessor {
    return (value as { bytes: BytesAccessor }).bytes // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
  }

  size(value: Opaque): number {
    return (value as { size: number }).size // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
  }

  stringTag(value: Opaque): string | undefined {
    return (value as { stringTag?: string }).stringTag
  }

  valueOf(value: Opaque): unknown {
    return (value as { valueOf: unknown }).valueOf
  }
}
