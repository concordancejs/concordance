import typesUtils from 'node:util/types'
import never from 'never'
import type { ValueRepresentation } from './value.js'
import type { Context, ContextOptions, DescribedSymbol, PropertyAccessCallback } from './context.js'
import { ArgumentsRepresentation } from './values/objects/arguments.ts' // eslint-disable-line import/no-cycle
import { type SymbolRepresentation } from './values/primitives/symbol.ts'
import { BoxedPrimitiveRepresentation } from './values/objects/boxed.ts'
import { ArrayRepresentation } from './values/objects/array.ts'
import { ErrorRepresentation } from './values/objects/error.ts'
import { ArrayBufferRepresentation } from './values/objects/array-buffer.ts'
import { ArrayBufferViewRepresentation } from './values/objects/array-buffer-view.ts'
import { FunctionRepresentation } from './values/objects/function.ts'
import { CryptoKeyRepresentation } from './values/web/crypto-key.ts'
import { DateRepresentation } from './values/objects/date.ts'
import { ExternalRepresentation } from './values/nodejs/external.ts'
import { MapRepresentation } from './values/objects/map.ts'
import { ModuleNamespaceObjectRepresentation } from './values/objects/module-namespace-object.ts'
import { PromiseRepresentation } from './values/objects/promise.ts'
import { ObjectRepresentation } from './values/objects/object.ts'
import { RegExpRepresentation } from './values/objects/regexp.ts'
import { SetRepresentation } from './values/objects/set.ts'
import { WeakMapRepresentation } from './values/objects/weak-map.ts'
import { WeakSetRepresentation } from './values/objects/weak-set.ts'
import {
  NamedPropertyGroup,
  NamedPropertyAccessor,
  SymbolPropertyGroup,
  SymbolPropertyAccessor,
} from './accessors/property.ts'
import { ElementAccessor } from './accessors/element.ts'
import { BytesAccessor } from './accessors/bytes.ts'
import { IteratorValueAccessor } from './accessors/iterator-value.ts'
import { MapEntryAccessor } from './accessors/map-entry.ts'
import { isPrimitive, representPrimitive } from './primitives.ts'
import { normalizeFlags, type Flags } from './flags.ts'

type Pointer = { value: ValueRepresentation; index: number }

class PointerMap extends WeakMap<WeakKey, Pointer> {
  #counter = 0

  getIndex(key: WeakKey): number | undefined {
    const pointer = this.get(key)
    return pointer?.index
  }

  getRepresentation(key: WeakKey): ValueRepresentation | undefined {
    const pointer = this.get(key)
    return pointer?.value
  }

  alloc(key: WeakKey, value: ValueRepresentation) {
    const index = ++this.#counter
    const pointer = { value, index }
    this.set(key, pointer)
    this.set(value, pointer)
  }
}

const { forEach } = Array.prototype

const wellKnownSymbols = new Map<symbol, string>(
  Object.getOwnPropertyNames(Symbol)
    .map((key: string) => [(Symbol as unknown as Record<string, unknown>)[key], key])
    .filter((entry): entry is [symbol, string] => typeof entry[0] === 'symbol'),
)

export class DescriptionContext implements Context {
  static is(context: Context): context is DescriptionContext {
    return #pointers in context
  }

  readonly #flags: Readonly<Flags>
  readonly #namedPropertyNotifiers = new Map<
    object,
    Map<string, { callback: PropertyAccessCallback; invoked: boolean }>
  >()

  readonly #pointers = new PointerMap()

  constructor(options?: ContextOptions) {
    this.#flags = normalizeFlags(options?.flags)
  }

  get deserialized() {
    return false
  }

  get flags() {
    return this.#flags
  }

  pointer(representation: ValueRepresentation) {
    return this.#pointers.getIndex(representation)
  }

  stringTag(value: object) {
    const tag = (value as Record<symbol, unknown>)[Symbol.toStringTag]
    return typeof tag === 'string' ? tag : undefined
  }

  isNullProto(value: object) {
    return Object.getPrototypeOf(value) === null
  }

  isObjectProto(value: object) {
    return Object.getPrototypeOf(value) === Object.prototype
  }

  constructorName(value: object) {
    if (typeof value.constructor === 'function') {
      const name = value.constructor?.name
      return typeof name === 'string' ? name : undefined
    }

    return undefined
  }

  isArrayLike(value: object) {
    if (!Reflect.has(value, 'length')) {
      return false
    }

    const { length } = value as { length: unknown }
    return (
      typeof length === 'number' &&
      Number.isSafeInteger(length) &&
      (length === 0 || (length > 0 && Reflect.has(value, '0')))
    )
  }

  length(value: object) {
    return (value as { length: number }).length
  }

  size(value: object) {
    return (value as { size: number }).size
  }

  namedProperties(value: object, ...include: string[]) {
    // Sort property names, they should never be order-sensitive. For array-like objects, reject names that are an
    // index.
    const isArrayLike = this.isArrayLike(value)
    const minNonArrayLikeIndex = isArrayLike ? this.length(value) : 0
    const nameCandidates = Object.getOwnPropertyNames(value)
      .filter((name) => {
        if (include.includes(name)) {
          return false
        }

        if (minNonArrayLikeIndex > 0) {
          const index = Number(name)
          if (Number.isInteger(index) && index >= 0 && index < minNonArrayLikeIndex) {
            return false
          }
        }

        return Object.getOwnPropertyDescriptor(value, name)?.enumerable ?? false
      })
      .concat(include.filter((name) => Reflect.has(value, name))) // eslint-disable-line unicorn/prefer-spread
      .sort()

    const properties: NamedPropertyAccessor[] = []
    const objectNotifiers = this.#namedPropertyNotifiers.get(value)
    for (const name of nameCandidates) {
      const propertyValue = this.represent((value as Record<string, unknown>)[name])
      const accessor = new NamedPropertyAccessor(name, propertyValue)
      properties.push(accessor)
      if (objectNotifiers && include.includes(name)) {
        const notifier = objectNotifiers.get(name)
        if (notifier?.invoked === false) {
          const { callback } = notifier
          callback(accessor, propertyValue)
          notifier.invoked = true
        }
      }
    }

    return new NamedPropertyGroup(this, properties)
  }

  notifyNextExplicitlyNamedPropertyAccess(value: object, name: string, callback: PropertyAccessCallback) {
    const objectNotifiers =
      this.#namedPropertyNotifiers.get(value) ??
      new Map<string, { callback: PropertyAccessCallback; invoked: boolean }>()
    if (!this.#namedPropertyNotifiers.has(value)) {
      this.#namedPropertyNotifiers.set(value, objectNotifiers)
    }

    // Throw error if a notifier is already registered for this property
    if (objectNotifiers.has(name)) {
      throw new Error(`A notifier is already registered for property '${name}'`)
    }

    objectNotifiers.set(name, { callback, invoked: false })
  }

  resetPropertyAccessNotifiers(value: object) {
    this.#namedPropertyNotifiers.delete(value)
  }

  symbolProperties(value: object) {
    // Comparators should verify symbols in an order-insensitive manner if
    // possible.
    const symbolCandidates = Object.getOwnPropertySymbols(value).filter((symbol) => {
      return Object.getOwnPropertyDescriptor(value, symbol)?.enumerable ?? false
    })

    return new SymbolPropertyGroup(
      symbolCandidates.map(
        (symbol) =>
          new SymbolPropertyAccessor(
            this,
            this.represent(symbol) as SymbolRepresentation,
            this.represent((value as Record<symbol, unknown>)[symbol]),
          ),
      ),
    )
  }

  *iterateElements(value: object) {
    const length = this.length(value)
    for (let index = 0; index < length; index++) {
      yield new ElementAccessor(index, this.represent((value as Record<number, unknown>)[index]))
    }
  }

  *iterateValues(value: object) {
    if (!Reflect.has(value, Symbol.iterator)) {
      return
    }

    let index = 0
    for (const element of value as Iterable<unknown>) {
      yield new IteratorValueAccessor(index++, this.represent(element))
    }
  }

  *iterateMapEntries(value: object) {
    for (const [key, element] of value as Map<unknown, unknown>) {
      yield new MapEntryAccessor(this, this.represent(key), this.represent(element))
    }
  }

  nonSparseArrayElements(value: object) {
    const elements: Array<[number, unknown]> = []

    forEach.call(value, (element, index) => {
      elements.push([index, element])
    })

    return elements
  }

  valueOf(value: object) {
    return value.valueOf() as unknown
  }

  describeSymbol(value: object): DescribedSymbol {
    const symbol = value as unknown as symbol
    const key = Symbol.keyFor(symbol)
    if (key !== undefined) {
      // This is a registered symbol.
      return { key, wellKnown: undefined, string: undefined }
    }

    const wellKnown = wellKnownSymbols.get(symbol)
    if (wellKnown !== undefined) {
      // This is a well-known symbol.
      return { key: undefined, wellKnown, string: undefined }
    }

    // This is a custom symbol, not registered and not well-known.
    return { key: undefined, wellKnown: undefined, string: symbol.toString() }
  }

  representBytes(value: object) {
    const buffer = ArrayBuffer.isView(value) ? value.buffer : (value as ArrayBufferLike)
    return new BytesAccessor(
      buffer,
      (value as { byteOffset?: number }).byteOffset ?? 0,
      (value as ArrayBufferLike).byteLength,
    )
  }

  represent(value: unknown): ValueRepresentation {
    if (isPrimitive(value)) {
      return representPrimitive(this, value)
    }

    if (this.#pointers.has(value)) {
      return this.#pointers.getRepresentation(value) ?? never()
    }

    const representation = this.#representObject(value)
    this.#pointers.alloc(value, representation)
    return representation
  }

  #representObject(value: object): ValueRepresentation {
    if (Array.isArray(value)) {
      return new ArrayRepresentation(this, value)
    }

    if (typeof value === 'function') {
      return new FunctionRepresentation(this, value)
    }

    const proto: unknown = Object.getPrototypeOf(value)
    if (proto === Object.prototype) {
      if (typesUtils.isArgumentsObject(value)) {
        return new ArgumentsRepresentation(this, value)
      }

      return new ObjectRepresentation(this, value)
    }

    if (proto === null) {
      if (typesUtils.isExternal(value)) {
        return new ExternalRepresentation(this, value)
      }

      if (typesUtils.isModuleNamespaceObject(value)) {
        return new ModuleNamespaceObjectRepresentation(this, value)
      }

      return new ObjectRepresentation(this, value)
    }

    // The following checks call into C++. Order so more likely values are checked first.

    if (typesUtils.isMap(value)) {
      return new MapRepresentation(this, value)
    }

    if (typesUtils.isSet(value)) {
      return new SetRepresentation(this, value)
    }

    if (typesUtils.isArrayBufferView(value)) {
      return new ArrayBufferViewRepresentation(this, value)
    }

    if (typesUtils.isNativeError(value)) {
      return new ErrorRepresentation(this, value)
    }

    if (typesUtils.isDate(value)) {
      return new DateRepresentation(this, value)
    }

    if (typesUtils.isRegExp(value)) {
      return new RegExpRepresentation(this, value)
    }

    if (typesUtils.isPromise(value)) {
      return new PromiseRepresentation(this, value)
    }

    if (typesUtils.isAnyArrayBuffer(value)) {
      return new ArrayBufferRepresentation(this, value)
    }

    if (typesUtils.isWeakMap(value)) {
      return new WeakMapRepresentation(this, value)
    }

    if (typesUtils.isWeakSet(value)) {
      return new WeakSetRepresentation(this, value)
    }

    if (typesUtils.isCryptoKey(value)) {
      return new CryptoKeyRepresentation(this, value)
    }

    if (typesUtils.isBoxedPrimitive(value)) {
      return new BoxedPrimitiveRepresentation(this, value, representPrimitive(this, value.valueOf()))
    }

    // Fall back to generic object representation, perhaps because the object is from another realm.
    return new ObjectRepresentation(this, value)
  }
}
