'use strict'

const getCtor = require('./getCtor')
const getTag = require('./getTag')
const ArgumentsComplex = require('./ArgumentsComplex')
const ArrayBufferComplex = require('./ArrayBufferComplex')
const Complex = require('./Complex')
const ErrorComplex = require('./ErrorComplex')
const FunctionComplex = require('./FunctionComplex')
const Primitive = require('./Primitive')
const PromiseComplex = require('./PromiseComplex')
const Registry = require('./Registry')

const SpecializedComplexes = new Map([
  ['Arguments', ArgumentsComplex],
  ['ArrayBuffer', ArrayBufferComplex],
  ['DataView', ArrayBufferComplex], // DataViews can be treated as ArrayBuffers
  ['Error', ErrorComplex],
  ['Function', FunctionComplex],
  ['Promise', PromiseComplex]
])

function describePrimitive (value) {
  const type = value === null
    ? 'null'
    : typeof value

  return type === 'boolean' ||
    type === 'null' ||
    type === 'number' ||
    type === 'string' ||
    type === 'symbol' ||
    type === 'undefined'
      ? new Primitive(type, value)
      : null
}

function unwrapComplex (tag, complex) {
  // Treat RegExp as a wrapper for strings.
  if (tag === 'RegExp') return describePrimitive(complex.toString())

  // Try to unwrap by calling `valueOf()`. `describePrimitive()` will return
  // `null` if the resulting value is not a primitive, in which case it's
  // ignored.
  if (typeof complex.valueOf === 'function') return describePrimitive(complex.valueOf())

  return null
}

function describeComplex (value, registry, describeNested) {
  if (registry.has(value)) return registry.get(value)

  const tag = getTag(value)
  const ctor = getCtor(tag, value)
  const unwrapped = unwrapComplex(tag, value)
  const pointer = registry.add(value)

  const klass = SpecializedComplexes.get(tag) || Complex
  return klass.fromValue(value, tag, ctor, unwrapped, pointer, describeNested)
}

function describe (value) {
  const registry = new Registry()
  const describeValue = v => describePrimitive(v) || describeComplex(v, registry, describeValue)
  return describeValue(value)
}
module.exports = describe
