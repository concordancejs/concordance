import test from 'ava'

import {format} from '../lib/format'
import getTag from '../lib/getTag'

test('formats primitives', t => {
  for (const [value, expected] of [
    [null, 'null'],
    [undefined, 'undefined'],
    [false, 'false'],
    [true, 'true'],
    ['', "''"],
    ['foo', "'foo'"],
    ['\\ -- \' -- "', '`\\\\ -- \' -- "`'],
    ['foo\nbar\\baz\'"', '`foo<LF>\nbar\\\\baz\'"`'],
    ['qux\r\nquux', '`qux<CR><LF>\nquux`'],
    ['qux\rquux', '`qux<CR>\nquux`'],
    [42, '42'],
    [-42, '-42'],
    [0, '0'],
    [-0, '-0'],
    [+0, '0'],
    [Infinity, 'Infinity'],
    [-Infinity, '-Infinity'],
    [NaN, 'NaN'],
    [Symbol(), 'Symbol()'], // eslint-disable-line symbol-description
    [Symbol('foo'), 'Symbol(foo)'],
    [Symbol.for('bar'), 'Symbol(bar)'],
    [Symbol.iterator, 'Symbol.iterator']
  ]) {
    t.is(format(value), expected)
  }
})

test('formats a simple object', t => {
  const obj = { foo: 'bar', baz: 'qux' }
  const actual = format(obj)
  t.is(actual, `Object {
  baz: 'qux',
  foo: 'bar',
}`)
})

test('formats a simple, nested object', t => {
  const obj = { foo: { baz: 'qux' } }
  const actual = format(obj)
  t.is(actual, `Object {
  foo: Object {
    baz: 'qux',
  },
}`)
})

test('formats multiline strings inside an object', t => {
  const actual = format({ 'foo\nbar': 'baz\nqux' })
  t.is(actual, `Object {
  'foo\\nbar': \`baz<LF>
  qux\`,
}`)
})

test('formats wrapped primitives', t => {
  for (const [value, expected, tag] of [
    [false, 'false', 'Boolean'],
    [true, 'true', 'Boolean'],
    [42, '42', 'Number'],
    [-42, '-42', 'Number'],
    [0, '0', 'Number'],
    [-0, '-0', 'Number'],
    [+0, '0', 'Number'],
    [Infinity, 'Infinity', 'Number'],
    [-Infinity, '-Infinity', 'Number'],
    [NaN, 'NaN', 'Number']
  ]) {
    t.is(format(Object(value)), `${tag} {
  ${expected}
}`)
  }
})

test('formats wrapped strings as a list', t => {
  t.is(format(Object('foo')), `String [
  'f',
  'o',
  'o',
]`)
})

test('formats a simple array', t => {
  const arr = ['foo', 'bar']
  const actual = format(arr)
  t.is(actual, `Array [
  'foo',
  'bar',
]`)
})

test('formats a simple, nested array', t => {
  const arr = [['foo', 'bar']]
  const actual = format(arr)
  t.is(actual, `Array [
  Array [
    'foo',
    'bar',
  ],
]`)
})

test('formats an array with additional properties', t => {
  const arr = ['foo', 'bar']
  arr.baz = 'qux'
  const actual = format(arr)
  t.is(actual, `Array [
  'foo',
  'bar',
  ---
  baz: 'qux',
]`)
})

test('formats a multiline string inside an array', t => {
  const actual = format(['bar\nbaz'])
  t.is(actual, `Array [
  \`bar<LF>
  baz\`,
]`)
})

test('formats maps', t => {
  const map = new Map()
  map.set('foo', 'bar')
  map.set({ baz: 'qux' }, 'quux')
  map.set('corge', { grault: 'garply' })
  const actual = format(map)
  t.is(actual, `Map {
  'foo' => 'bar',
  Object {
    baz: 'qux',
  } => 'quux',
  'corge' => Object {
    grault: 'garply',
  },
}`)
})

test('formats multiline strings inside a map', t => {
  const actual = format(new Map([['foo\nbar', 'baz\nqux']]))
  t.is(actual, `Map {
  \`foo<LF>
  bar\` => \`baz<LF>
  qux\`,
}`)
})

test('formats maps with additional properties', t => {
  const map = new Map()
  map.set('foo', 'bar')
  map.baz = 'qux'
  const actual = format(map)
  t.is(actual, `Map {
  baz: 'qux',
  ---
  'foo' => 'bar',
}`)
})

test('formats sets', t => {
  const set = new Set()
  set.add('foo')
  set.add({ bar: 'baz' })
  const actual = format(set)
  t.is(actual, `Set {
  'foo',
  Object {
    bar: 'baz',
  },
}`)
})

test('formats a multiline string inside sets', t => {
  const actual = format(new Set(['bar\nbaz']))
  t.is(actual, `Set {
  \`bar<LF>
  baz\`,
}`)
})

test('formats sets with additional properties', t => {
  const set = new Set()
  set.add('foo')
  set.bar = 'baz'
  const actual = format(set)
  t.is(actual, `Set {
  bar: 'baz',
  ---
  'foo',
}`)
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
  t.is(actual, `Object [
  'first',
  'second',
  ---
  foo: 'bar',
  ---
  'baz',
]`)
})

test('formats regular expressions', t => {
  const actual = format(/foo/gim)
  t.is(actual, '/foo/gim')
})

test('formats regular expressions with additional properties', t => {
  const actual = format(Object.assign(/foo/gim, { bar: 'baz' }))
  t.is(actual, `RegExp {
  /foo/gim
  ---
  bar: 'baz',
}`)
})

test('formats anonymous functions', t => {
  const actual = format(() => {})
  t.is(actual, 'Function')
})

test('formats named functions', t => {
  const actual = format(function foo () {})
  t.is(actual, 'Function foo')
})

test('formats functions with additional properties', t => {
  const actual = format(Object.assign(function foo () {}, { bar: 'baz' }))
  t.is(actual, `Function foo {
  bar: 'baz',
}`)
})

{
  // Node.js 4 provides Function, more recent versions use GeneratorFunction
  const tag = getTag(function * () {})

  test('formats anonymous generator functions', t => {
    const actual = format(function * () {})
    t.is(actual, `${tag}`)
  })

  test('formats named generator functions', t => {
    const actual = format(function * foo () {})
    t.is(actual, `${tag} foo`)
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
    t.is(actual, `Arguments [
  'foo',
  'bar',
  'baz',
]`)
  })('foo', 'bar', 'baz')
})

test('formats simple errors', t => {
  const actual = format(new TypeError('Test message'))
  t.is(actual, `TypeError {
  message: 'Test message',
}`)
})

test('formats simple errors with a modified name', t => {
  const err = new TypeError('Test message')
  err.name = 'FooError'
  const actual = format(err)
  t.is(actual, `FooError (TypeError) {
  message: 'Test message',
}`)
})

test('formats errors with a name that does not include Error and does not match the constructor', t => {
  class Foo extends Error {
    constructor (message) {
      super(message)
      this.name = 'Bar'
    }
  }
  const actual = format(new Foo('Test message'))
  t.is(actual, `Bar (Foo) @Error {
  message: 'Test message',
}`)
})

test('formats errors with additional properties', t => {
  const actual = format(Object.assign(new TypeError('Test message'), { foo: 'bar' }))
  t.is(actual, `TypeError {
  foo: 'bar',
  message: 'Test message',
}`)
})

test('formats promises', t => {
  const actual = format(Promise.resolve())
  t.is(actual, 'Promise {}')
})

test('formats promises with additional properties', t => {
  const actual = format(Object.assign(Promise.resolve(), { foo: 'bar' }))
  t.is(actual, `Promise {
  foo: 'bar',
}`)
})

test('formats pointers', t => {
  const obj = { foo: 'bar' }
  const actual = format({ baz: obj, qux: { quux: obj } })
  t.is(actual, `Object {
  baz: Object {
    foo: 'bar',
  },
  qux: Object {
    quux: Object {
      foo: 'bar',
    },
  },
}`)
})

test('formats circular references', t => {
  const obj = {}
  obj.circular = obj
  const actual = format(obj)
  t.is(actual, `Object {
  circular: [Circular],
}`)
})

{
  const plain = (t, value, tag) => {
    const actual = format(value)
    t.is(actual, `${tag} [
  decafbad decafbad decafbad decafbad decafbad decafbad decafbad decafbad
  decafbad decafbad decafbad decafbad
]`)
  }
  plain.title = (_, __, tag) => `formats ${tag}`

  const withProperties = (t, value, tag) => {
    const actual = format(Object.assign(value, { foo: 'bar' }))
    t.is(actual, `${tag} [
  decafbad decafbad decafbad decafbad decafbad decafbad decafbad decafbad
  decafbad decafbad decafbad decafbad
  ---
  foo: 'bar',
]`)
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
  t.is(actual, 'Date 1969-07-20T20:17:40.000Z')
})

test('formats dates with additional properties', t => {
  const actual = format(Object.assign(new Date('1969-07-20T20:17:40Z'), { foo: 'bar' }))
  t.is(actual, `Date 1969-07-20T20:17:40.000Z {
  foo: 'bar',
}`)
})

test('shows non-Object tag if constructor name is different', t => {
  class Foo {}
  const actual1 = format(new Foo())
  t.is(actual1, 'Foo {}')

  class Bar extends Array {}
  const actual2 = format(new Bar())
  t.is(actual2, 'Bar @Array []')

  class Baz extends Date {}
  const actual3 = format(new Baz('1969-07-20T20:17:40Z'))
  t.is(actual3, 'Baz @Date 1969-07-20T20:17:40.000Z')

  class Qux extends RegExp {}
  const actual4 = format(new Qux('foo'))
  t.is(actual4, `Qux @RegExp {
  /foo/
}`)

  class Quux extends Int16Array {}
  const actual5 = format(new Quux())
  t.is(actual5, 'Quux @Int16Array []')
})

test('formats global', t => {
  t.is(format(global), 'Global {}')
})
