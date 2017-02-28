'use strict'

const getCtor = require('./getCtor')
const getTag = require('./getTag')
const ArgumentsComplex = require('./ArgumentsComplex')
const ArrayBufferComplex = require('./ArrayBufferComplex')
const BooleanPrimitive = require('./BooleanPrimitive')
const Complex = require('./Complex')
const ComplexItem = require('./ComplexItem')
const ComplexProperty = require('./ComplexProperty')
const DataViewComplex = require('./DataViewComplex')
const ErrorComplex = require('./ErrorComplex')
const FunctionComplex = require('./FunctionComplex')
const TypedArrayComplex = require('./TypedArrayComplex')
const MapComplex = require('./MapComplex')
const MapEntry = require('./MapEntry')
const NullPrimitive = require('./NullPrimitive')
const NumberPrimitive = require('./NumberPrimitive')
const PrimitiveItem = require('./PrimitiveItem')
const PrimitiveProperty = require('./PrimitiveProperty')
const PromiseComplex = require('./PromiseComplex')
const RegExpComplex = require('./RegExpComplex')
const Registry = require('./Registry')
const SetComplex = require('./SetComplex')
const StringPrimitive = require('./StringPrimitive')
const SymbolPrimitive = require('./SymbolPrimitive')
const UndefinedPrimitive = require('./UndefinedPrimitive')

const SpecializedComplexes = new Map([
  ['Arguments', ArgumentsComplex],
  ['ArrayBuffer', ArrayBufferComplex],
  ['DataView', DataViewComplex],
  ['Error', ErrorComplex],
  ['Float32Array', TypedArrayComplex],
  ['Float64Array', TypedArrayComplex],
  ['Function', FunctionComplex],
  ['GeneratorFunction', FunctionComplex],
  ['Int16Array', TypedArrayComplex],
  ['Int32Array', TypedArrayComplex],
  ['Int8Array', TypedArrayComplex],
  ['Map', MapComplex],
  ['Promise', PromiseComplex],
  ['RegExp', RegExpComplex],
  ['Set', SetComplex],
  ['Uint16Array', TypedArrayComplex],
  ['Uint32Array', TypedArrayComplex],
  ['Uint8Array', TypedArrayComplex],
  ['Uint8ClampedArray', TypedArrayComplex]
])

function describePrimitive (value) {
  if (value === null) return new NullPrimitive()
  if (value === undefined) return new UndefinedPrimitive()
  if (value === true || value === false) return new BooleanPrimitive(value)

  const type = typeof value
  if (type === 'number') return new NumberPrimitive(value)
  if (type === 'string') return new StringPrimitive(value)
  if (type === 'symbol') return new SymbolPrimitive(value)

  return null
}

function unwrapComplex (tag, complex) {
  // Try to unwrap by calling `valueOf()`. `describePrimitive()` will return
  // `null` if the resulting value is not a primitive, in which case it's
  // ignored.
  if (typeof complex.valueOf === 'function') {
    const value = complex.valueOf()
    if (value !== complex) return describePrimitive(value)
  }

  return null
}

function describeComplex (value, registry, describeItem, describeMapEntry, describeProperty) {
  if (registry.has(value)) return registry.get(value)

  const tag = getTag(value)
  const ctor = getCtor(tag, value)
  const unwrapped = unwrapComplex(tag, value)
  const pointer = registry.add(value)

  const klass = SpecializedComplexes.get(tag) || Complex
  return klass.fromValue(value, tag, ctor, unwrapped, pointer, describeItem, describeMapEntry, describeProperty)
}

function describe (value) {
  const primitive = describePrimitive(value)
  if (primitive !== null) return primitive

  const registry = new Registry()
  const curriedComplex = c => describeComplex(c, registry, describeItem, describeMapEntry, describeProperty) // eslint-disable-line no-use-before-define

  const describeItem = (index, item) => {
    const primitiveValue = describePrimitive(item)
    if (primitiveValue !== null) return new PrimitiveItem(index, primitiveValue)

    return new ComplexItem(index, curriedComplex(item))
  }

  const describeMapEntry = (k, v) => {
    return new MapEntry(k, v, describePrimitive, curriedComplex)
  }

  const describeProperty = (k, v) => {
    const key = describePrimitive(k)
    const primitiveValue = describePrimitive(v)
    if (primitiveValue !== null) return new PrimitiveProperty(key, primitiveValue)

    return new ComplexProperty(key, curriedComplex(v))
  }

  return curriedComplex(value)
}
module.exports = describe
