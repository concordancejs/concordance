import test from 'ava'

import {format} from '../lib/format'
import getStringTag from '../lib/getStringTag'

{
  const formatsPrimitive = (t, value) => t.snapshot(format(value))
  formatsPrimitive.title = (_, value) => {
    const str = String(value)
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
    return `formats primitive: ${str}`
  }
  for (const value of [
    null,
    undefined,
    false,
    true,
    '',
    'foo',
    '\\ -- \' -- "',
    'foo\nbar\\baz\'"',
    'qux\r\nquux',
    'qux\rquux',
    42,
    -42,
    0,
    -0,
    +0,
    Infinity,
    -Infinity,
    NaN,
    Symbol(), // eslint-disable-line symbol-description
    Symbol('foo'),
    Symbol.for('bar'),
    Symbol.iterator
  ]) {
    test(formatsPrimitive, value)
  }
}

test('formats a simple object', t => {
  const obj = { foo: 'bar', baz: 'qux' }
  const actual = format(obj)
  t.snapshot(actual)
})

test('formats a simple, nested object', t => {
  const obj = { foo: { baz: 'qux' } }
  const actual = format(obj)
  t.snapshot(actual)
})

test('formats multiline strings inside an object', t => {
  const actual = format({ 'foo\nbar': 'baz\nqux' })
  t.snapshot(actual)
})

{
  const formatsWrappedPrimitive = (t, value) => t.snapshot(format(Object(value)))
  formatsWrappedPrimitive.title = (_, value) => `formats wrapped primitive: ${String(value)}`
  for (const value of [
    false,
    true,
    42,
    -42,
    0,
    -0,
    +0,
    Infinity,
    -Infinity,
    NaN
  ]) {
    test(formatsWrappedPrimitive, value)
  }
}

test('formats wrapped strings as a list', t => {
  t.snapshot(format(Object('foo')))
})

test('formats a simple array', t => {
  const arr = ['foo', 'bar']
  const actual = format(arr)
  t.snapshot(actual)
})

test('formats a simple, nested array', t => {
  const arr = [['foo', 'bar']]
  const actual = format(arr)
  t.snapshot(actual)
})

test('formats an array with additional properties', t => {
  const arr = ['foo', 'bar']
  arr.baz = 'qux'
  const actual = format(arr)
  t.snapshot(actual)
})

test('formats a multiline string inside an array', t => {
  const actual = format(['bar\nbaz'])
  t.snapshot(actual)
})

test('formats maps', t => {
  const map = new Map()
  map.set('foo', 'bar')
  map.set({ baz: 'qux' }, 'quux')
  map.set('corge', { grault: 'garply' })
  const actual = format(map)
  t.snapshot(actual)
})

test('formats multiline strings inside a map', t => {
  const actual = format(new Map([['foo\nbar', 'baz\nqux']]))
  t.snapshot(actual)
})

test('formats maps with additional properties', t => {
  const map = new Map()
  map.set('foo', 'bar')
  map.baz = 'qux'
  const actual = format(map)
  t.snapshot(actual)
})

test('formats sets', t => {
  const set = new Set()
  set.add('foo')
  set.add({ bar: 'baz' })
  const actual = format(set)
  t.snapshot(actual)
})

test('formats a multiline string inside sets', t => {
  const actual = format(new Set(['bar\nbaz']))
  t.snapshot(actual)
})

test('formats sets with additional properties', t => {
  const set = new Set()
  set.add('foo')
  set.bar = 'baz'
  const actual = format(set)
  t.snapshot(actual)
})

test('formats funky objects that are lists and have an iterator', t => {
  const funky = {
    0: 'first',
    1: 'second',
    foo: 'bar'
  }
  Object.defineProperty(funky, 'length', { value: 2 })
  Object.defineProperty(funky, Symbol.iterator, { * value () { yield 'baz' } })

  const actual = format(funky)
  t.snapshot(actual)
})

test('formats regular expressions', t => {
  const actual = format(/foo/gim)
  t.snapshot(actual)
})

test('formats regular expressions with additional properties', t => {
  const actual = format(Object.assign(/foo/gim, { bar: 'baz' }))
  t.snapshot(actual)
})

test('formats anonymous functions', t => {
  const actual = format(() => {})
  t.snapshot(actual)
})

test('formats named functions', t => {
  const actual = format(function foo () {})
  t.snapshot(actual)
})

test('formats functions with additional properties', t => {
  const actual = format(Object.assign(function foo () {}, { bar: 'baz' }))
  t.snapshot(actual)
})

{
  // Node.js 4 provides Function, more recent versions use GeneratorFunction
  const tag = getStringTag(function * () {})

  test('formats anonymous generator functions', t => {
    const actual = format(function * () {})
    t.is(actual, `${tag} {}`)
  })

  test('formats named generator functions', t => {
    const actual = format(function * foo () {})
    t.is(actual, `${tag} foo {}`)
  })

  test('formats generator functions with additional properties', t => {
    const actual = format(Object.assign(function * foo () {}, { bar: 'baz' }))
    t.is(actual, `${tag} foo {
  bar: 'baz',
}`)
  })
}

test('formats arguments', t => {
  (function (a, b, c) {
    const actual = format(arguments)
    t.snapshot(actual)
  })('foo', 'bar', 'baz')
})

test('formats simple errors', t => {
  const actual = format(new TypeError('Test message'))
  t.snapshot(actual)
})

test('formats simple errors with a modified name', t => {
  const err = new TypeError('Test message')
  err.name = 'FooError'
  const actual = format(err)
  t.snapshot(actual)
})

test('formats errors with a name that does not include Error and does not match the constructor', t => {
  class Foo extends Error {
    constructor (message) {
      super(message)
      this.name = 'Bar'
    }
  }
  const actual = format(new Foo('Test message'))
  t.snapshot(actual)
})

test('formats errors with additional properties', t => {
  const actual = format(Object.assign(new TypeError('Test message'), { foo: 'bar' }))
  t.snapshot(actual)
})

test('formats promises', t => {
  const actual = format(Promise.resolve())
  t.snapshot(actual)
})

test('formats promises with additional properties', t => {
  const actual = format(Object.assign(Promise.resolve(), { foo: 'bar' }))
  t.snapshot(actual)
})

test('formats pointers', t => {
  const obj = { foo: 'bar' }
  const actual = format({ baz: obj, qux: { quux: obj } })
  t.snapshot(actual)
})

test('formats circular references', t => {
  const obj = {}
  obj.circular = obj
  const actual = format(obj)
  t.snapshot(actual)
})

{
  const plain = (t, value, tag) => {
    const actual = format(value)
    t.snapshot(actual)
  }
  plain.title = (_, __, tag) => `formats ${tag}`

  const withProperties = (t, value, tag) => {
    const actual = format(Object.assign(value, { foo: 'bar' }))
    t.snapshot(actual)
  }
  withProperties.title = (_, __, tag) => `formats ${tag} with additional properties`

  const buffer = Buffer.from('decafbad'.repeat(12), 'hex')
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

  for (const [tag, value, valueForProps] of [
    ['ArrayBuffer', arrayBuffer],
    ['Buffer @Uint8Array', buffer],
    ['DataView', new DataView(arrayBuffer), new DataView(arrayBuffer)],
    ['Float32Array', new Float32Array(arrayBuffer)],
    ['Float64Array', new Float64Array(arrayBuffer)],
    ['Int16Array', new Int16Array(arrayBuffer)],
    ['Int32Array', new Int32Array(arrayBuffer)],
    ['Int8Array', new Int8Array(arrayBuffer)],
    ['Uint16Array', new Uint16Array(arrayBuffer)],
    ['Uint32Array', new Uint32Array(arrayBuffer)],
    ['Uint8Array', new Uint8Array(arrayBuffer)],
    ['Uint8ClampedArray', new Uint8ClampedArray(arrayBuffer)]
  ]) {
    test(plain, value, tag)
    test(withProperties, valueForProps || value.slice(), tag)
  }
}

test('formats dates', t => {
  const actual = format(new Date('1969-07-20T20:17:40Z'))
  t.snapshot(actual)
})

test('formats dates with additional properties', t => {
  const actual = format(Object.assign(new Date('1969-07-20T20:17:40Z'), { foo: 'bar' }))
  t.snapshot(actual)
})

test('shows non-Object tag if constructor name is different', t => {
  class Foo {}
  const actual1 = format(new Foo())
  t.snapshot(actual1)

  class Bar extends Array {}
  const actual2 = format(new Bar())
  t.snapshot(actual2)

  class Baz extends Date {}
  const actual3 = format(new Baz('1969-07-20T20:17:40Z'))
  t.snapshot(actual3)

  class Qux extends RegExp {}
  const actual4 = format(new Qux('foo'))
  t.snapshot(actual4)

  class Quux extends Int16Array {}
  const actual5 = format(new Quux())
  t.snapshot(actual5)
})

test('formats global', t => {
  t.snapshot(format(global))
})
