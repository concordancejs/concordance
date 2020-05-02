const test = require('ava')

const { compareDescriptors, describe, diffDescriptors, formatDescriptor } = require('..')
const { deserialize, serialize } = require('../lib/serialize')
const customErrorPlugin = require('./fixtures/customErrorPlugin')

test('serializes a descriptor into a buffer', t => {
  const result = serialize(describe({ foo: 'bar' }))
  t.true(Buffer.isBuffer(result))
})

const plugins = [
  {
    name: 'CustomError',
    apiVersion: 1,
    serializerVersion: 1,
    register: props => {
      const custom = customErrorPlugin.factory(props)
      props.addDescriptor(1, custom.tag, custom.deserialize)
      return function (value) {
        if (value.name === 'CustomError') {
          return custom.describe
        }
      }
    },
  },
]

const useDeserialized = (t, value, options) => {
  const original = describe(value, options)

  const buffer = serialize(original)
  const deserialized = deserialize(buffer, options)
  t.true(
    compareDescriptors(deserialized, original),
    'the deserialized descriptor equals the original')
  t.is(
    formatDescriptor(deserialized),
    formatDescriptor(original),
    'the deserialized descriptor is formatted like the original')

  const redeserialized = deserialize(serialize(deserialized), options)
  t.true(
    compareDescriptors(redeserialized, original),
    'after serializing and deserializing it again, the deserialized descriptor equals the original')
  t.is(
    formatDescriptor(redeserialized),
    formatDescriptor(original),
    'after serializing and deserializing it again, the deserialized descriptor is formatted like the original')

  t.true(
    compareDescriptors(redeserialized, deserialized),
    'deserialized descriptors equal each other')
}
useDeserialized.title = (desc, value) => `deserialized ${desc || String(value)} is equivalent to the original`

// Primitives
test(useDeserialized, true)
test(useDeserialized, false)
test(useDeserialized, null)
test(useDeserialized, 0)
test('-0', useDeserialized, -0)
test(useDeserialized, NaN)
test(useDeserialized, Infinity)
test(useDeserialized, -Infinity)
test('-0x80 (int8)', useDeserialized, -0x80)
test('0x7F (int8)', useDeserialized, 0x7F)
test('-0x8000 (int16)', useDeserialized, -0x8000)
test('0x7FFF (int16)', useDeserialized, 0x7FFF)
test('-0x800000 (int24)', useDeserialized, -0x800000)
test('0x7FFFFF (int24)', useDeserialized, 0x7FFFFF)
test('-0x80000000 (int32)', useDeserialized, -0x80000000)
test('0x7FFFFFFF (int32)', useDeserialized, 0x7FFFFFFF)
test('-0x8000000000 (int40)', useDeserialized, -0x8000000000)
test('0x7FFFFFFFFF (int40)', useDeserialized, 0x7FFFFFFFFF)
test('-0x800000000000 (int48)', useDeserialized, -0x800000000000)
test('0x7FFFFFFFFFFF (int48)', useDeserialized, 0x7FFFFFFFFFFF)
test('-0x800000000001 (larger than int48)', useDeserialized, -0x80000000001)
test('0x800000000000 (larger than int48)', useDeserialized, 0x800000000000)
test('Number.MIN_VALUE', useDeserialized, Number.MIN_VALUE)
test('Number.MAX_VALUE', useDeserialized, Number.MAX_VALUE)
test('0.1 + 0.2 (float)', useDeserialized, 0.1 + 0.2)
test('\'foo\' (ascii string)', useDeserialized, 'foo')
test('\'🚀\' (unicode string)', useDeserialized, '🚀')
test('Symbol.iterator', useDeserialized, Symbol.iterator)
test('Symbol.for(\'foo\')', useDeserialized, Symbol.for('foo'))
test('Symbol(\'foo\')', useDeserialized, Symbol('foo'))
test(useDeserialized, undefined)

if (typeof BigInt === 'function') {
  test('42n', useDeserialized, BigInt(42)) // eslint-disable-line no-undef
}

// Objects
test('object with primitive property', useDeserialized, { foo: 'bar' })
test('object with complex property', useDeserialized, { foo: {} })
test('object with well known symbol key', useDeserialized, { [Symbol.unscopables]: 'bar' })
test('object with registered symbol key', useDeserialized, { [Symbol.for('foo')]: 'bar' })
test('object with arbitrary symbol key', useDeserialized, { [Symbol('foo')]: 'bar' })
test('object with length property', useDeserialized, { length: 12345678 })
test('object with negative length property', useDeserialized, { length: -12345678 })
test('object with NaN length property', useDeserialized, { length: NaN })
test('object with infinite length property', useDeserialized, { length: Infinity })
test('object with fractional length property', useDeserialized, { length: 1.5 })

test('symbol properties are reordered despite serialization', t => {
  const s1 = Symbol('s1')
  const s2 = Symbol('s2')
  const original = describe({ [s1]: 1, [s2]: 2 })
  const expected = describe({ [s2]: 2, [s1]: 1 })

  t.true(compareDescriptors(deserialize(serialize(original)), expected))
  t.snapshot(diffDescriptors(deserialize(serialize(original)), expected))

  t.true(compareDescriptors(deserialize(serialize(original)), deserialize(serialize(expected))))
  t.snapshot(diffDescriptors(deserialize(serialize(original)), deserialize(serialize(expected))))
})

// Arrays
test('array with primitive item', useDeserialized, ['bar'])
test('array with complex item', useDeserialized, [{}])

// Iterators
test('iterator with primitive item', useDeserialized,
  Object.create({}, {
    [Symbol.iterator]: {
      enumerable: false,
      * value () { return 'bar' },
    },
  }))
test('iterator with complex item', useDeserialized,
  Object.create({}, {
    [Symbol.iterator]: {
      enumerable: false,
      * value () { return {} },
    },
  }))

// Maps
test('map with primitive key and value', useDeserialized, new Map([['foo', 'bar']]))
test('map with complex key and primitive value', useDeserialized, new Map([[{}, 'bar']]))
test('map with complex key and value', useDeserialized, new Map([[{}, {}]]))
test('map with primitive key and complex value', useDeserialized, new Map([['foo', {}]]))

// Sets
test('set with primitive value', useDeserialized, new Set(['foo']))
test('set with complex value', useDeserialized, new Set([{}]))

// Pointers
{
  const obj = {}
  obj.self = obj
  test('object with pointer to itself', useDeserialized, obj)
}

// Other complex values
test('arguments', useDeserialized, (function () { return arguments })('foo', {}))
{
  const buffer = Buffer.from('decafbad'.repeat(12), 'hex')
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

  for (const [tag, value] of [
    ['ArrayBuffer', arrayBuffer],
    ['Buffer @Uint8Array', buffer],
    ['DataView', new DataView(arrayBuffer)],
    ['Float32Array', new Float32Array(arrayBuffer)],
    ['Float64Array', new Float64Array(arrayBuffer)],
    ['Int16Array', new Int16Array(arrayBuffer)],
    ['Int32Array', new Int32Array(arrayBuffer)],
    ['Int8Array', new Int8Array(arrayBuffer)],
    ['Uint16Array', new Uint16Array(arrayBuffer)],
    ['Uint32Array', new Uint32Array(arrayBuffer)],
    ['Uint8Array', new Uint8Array(arrayBuffer)],
    ['Uint8ClampedArray', new Uint8ClampedArray(arrayBuffer)],
  ]) {
    test(tag, useDeserialized, value)
  }
}
test('date', useDeserialized, new Date('1969-07-20T20:17:40Z'))
test('error', useDeserialized, new Error('foo'))
test('function', useDeserialized, function foo () {})
test('compare functions with different names', t => {
  function a () { return 1 + 2 } // eslint-disable-line unicorn/consistent-function-scoping
  function b () { return 1 + 2 } // eslint-disable-line unicorn/consistent-function-scoping

  const original = describe(a)
  const deserialized = deserialize(serialize(original))
  t.false(compareDescriptors(deserialized, describe(b)))
  t.not(formatDescriptor(deserialized), formatDescriptor(describe(b)))
})
test('compare deserialized function with object', t => {
  function a () { return 1 + 2 } // eslint-disable-line unicorn/consistent-function-scoping
  const b = { bar: 'b' }

  const original = describe(a)
  const deserialized = deserialize(serialize(original))
  t.false(compareDescriptors(deserialized, describe(b)))
  t.not(formatDescriptor(deserialized), formatDescriptor(describe(b)))
})
test('generator function', useDeserialized, function * foo () {})
test('global', useDeserialized, global)
test('promise', useDeserialized, Promise.resolve())
test('regexp', useDeserialized, /foo/gi)

test('plugin', useDeserialized, new customErrorPlugin.CustomError('custom error', 'PLUGIN', 1), { plugins })
test('should fail when plugin for deserialization missing', t => {
  const deserializationPlugins = [
    {
      name: 'CustomError_v2',
      apiVersion: 1,
      serializerVersion: 2,
      register: props => {
        const custom = customErrorPlugin.factory(props)
        props.addDescriptor(1, Symbol('CustomError_v2'), custom.deserialize)
        return function (value) {
          if (value.name === 'CustomError') {
            return custom.describe
          }
        }
      },
    },
  ]

  t.throws(() => {
    const serialized = serialize(describe(new customErrorPlugin.CustomError('custom error', 'PLUGIN', 1), { plugins }))
    deserialize(serialized, { plugins: deserializationPlugins })
  }, { name: 'MissingPluginError' })
})
