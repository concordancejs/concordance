/*
Copyright JS Foundation and other contributors <https://js.foundation/>

Based on Underscore.js, copyright Jeremy Ashkenas,
DocumentCloud and Investigative Reporters & Editors <http://underscorejs.org/>

This software consists of voluntary contributions made by many
individuals. For exact contribution history, see the revision history
available at https://github.com/lodash/lodash

====

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

===

Tests adopted from https://github.com/lodash/lodash/blob/3967c1e1197b726463246b47521a4099ab74cb35/test/test.js#L9477:L10291>
*/

/* eslint-disable unicorn/consistent-function-scoping */

const vm = require('vm')
const test = require('ava')
const { compare } = require('../lib/compare')

const isEqual = (actual, expected) => compare(actual, expected).pass

const realm = vm.runInNewContext('(function () { return this })()')
const symbol1 = Symbol ? Symbol('a') : true
const symbol2 = Symbol ? Symbol('b') : false

test('compare primitives', t => {
  const pairs = [
    [1, 1, true], [1, new Object(1), false], [1, '1', false], [1, 2, false],
    [-0, -0, true], [0, 0, true], [0, new Object(0), false], [new Object(0), new Object(0), true], [-0, 0, false], [0, '0', false], [0, null, false], // eslint-disable-line max-len
    [NaN, NaN, true], [NaN, new Object(NaN), false], [new Object(NaN), new Object(NaN), true], [NaN, 'a', false], [NaN, Infinity, false], // eslint-disable-line max-len
    ['a', 'a', true], ['a', new Object('a'), false], [new Object('a'), new Object('a'), true], ['a', 'b', false], ['a', ['a'], false], // eslint-disable-line max-len
    [true, true, true], [true, new Object(true), false], [new Object(true), new Object(true), true], [true, 1, false], [true, 'a', false], // eslint-disable-line max-len
    [false, false, true], [false, new Object(false), false], [new Object(false), new Object(false), true], [false, 0, false], [false, '', false], // eslint-disable-line max-len
    [symbol1, symbol1, true], [symbol1, new Object(symbol1), false], [new Object(symbol1), new Object(symbol1), true], [symbol1, symbol2, false], // eslint-disable-line max-len
    [null, null, true], [null, undefined, false], [null, {}, false], [null, '', false],
    [undefined, undefined, true], [undefined, null, false], [undefined, '', false],
  ]

  for (const [lhs, rhs, result] of pairs) {
    t.is(isEqual(lhs, rhs), result)
  }
})

test('compare arrays', t => {
  let array1 = [true, null, 1, 'a', undefined]
  let array2 = [true, null, 1, 'a', undefined]

  t.true(isEqual(array1, array2))

  array1 = [[1, 2, 3], new Date(2012, 4, 23), /x/, { e: 1 }]
  array2 = [[1, 2, 3], new Date(2012, 4, 23), /x/, { e: 1 }]

  t.true(isEqual(array1, array2))

  array1 = [1]
  array1[2] = 3

  array2 = [1]
  array2[1] = undefined
  array2[2] = 3

  t.true(isEqual(array1, array2))

  array1 = [new Object(1), false, new Object('a'), /x/, new Date(2012, 4, 23), ['a', 'b', [new Object('c')]], { a: 1 }]
  array2 = [1, new Object(false), 'a', /x/, new Date(2012, 4, 23), ['a', new Object('b'), ['c']], { a: 1 }]

  t.false(isEqual(array1, array2))

  array1 = [1, 2, 3]
  array2 = [3, 2, 1]

  t.false(isEqual(array1, array2))

  array1 = [1, 2]
  array2 = [1, 2, 3]

  t.false(isEqual(array1, array2))
})

test('treat arrays with identical values but different non-index properties as unequal', t => {
  let array1 = [1, 2, 3]
  let array2 = [1, 2, 3]

  array1.every = array1.filter = array1.forEach =
  array1.indexOf = array1.lastIndexOf = array1.map =
  array1.some = array1.reduce = array1.reduceRight = null

  array2.concat = array2.join = array2.pop =
  array2.reverse = array2.shift = array2.slice =
  array2.sort = array2.splice = array2.unshift = null

  t.false(isEqual(array1, array2))

  array1 = [1, 2, 3]
  array1.a = 1

  array2 = [1, 2, 3]
  array2.b = 1

  t.false(isEqual(array1, array2))

  array1 = /c/.exec('abcde')
  array2 = ['c']

  t.false(isEqual(array1, array2))
})

test('compare sparse arrays', t => {
  const array = new Array(1)

  t.true(isEqual(array, new Array(1)))
  t.true(isEqual(array, [undefined]))
  t.false(isEqual(array, new Array(2)))
})

test('compare plain objects', t => {
  let object1 = { a: true, b: null, c: 1, d: 'a', e: undefined }
  let object2 = { a: true, b: null, c: 1, d: 'a', e: undefined }

  t.true(isEqual(object1, object2))

  object1 = { a: [1, 2, 3], b: new Date(2012, 4, 23), c: /x/, d: { e: 1 } }
  object2 = { a: [1, 2, 3], b: new Date(2012, 4, 23), c: /x/, d: { e: 1 } }

  t.true(isEqual(object1, object2))

  object1 = { a: 1, b: 2, c: 3 }
  object2 = { a: 3, b: 2, c: 1 }

  t.false(isEqual(object1, object2))

  object1 = { a: 1, b: 2, c: 3 }
  object2 = { d: 1, e: 2, f: 3 }

  t.false(isEqual(object1, object2))

  object1 = { a: 1, b: 2 }
  object2 = { a: 1, b: 2, c: 3 }

  t.false(isEqual(object1, object2))
})

test('compare objects regardless of key order', t => {
  const object1 = { a: 1, b: 2, c: 3 }
  const object2 = { c: 3, a: 1, b: 2 }

  t.true(isEqual(object1, object2))
})

test('compare nested objects', t => {
  const noop = () => {}

  const object1 = {
    a: [1, 2, 3],
    b: true,
    c: 1,
    d: 'a',
    e: {
      f: ['a', 'b', 'c'],
      g: false,
      h: new Date(2012, 4, 23),
      i: noop,
      j: 'a',
    },
  }

  const object2 = {
    a: [1, 2, 3],
    b: true,
    c: 1,
    d: 'a',
    e: {
      f: ['a', 'b', 'c'],
      g: false,
      h: new Date(2012, 4, 23),
      i: noop,
      j: 'a',
    },
  }

  t.true(isEqual(object1, object2))
})

test('compare object instances', t => {
  function Foo () {
    this.a = 1
  }
  Foo.prototype.a = 1

  function Bar () {
    this.a = 1
  }
  Bar.prototype.a = 2

  t.true(isEqual(new Foo(), new Foo()))
  t.false(isEqual(new Foo(), new Bar()))
  t.false(isEqual({ a: 1 }, new Foo()))
  t.false(isEqual({ a: 2 }, new Bar()))
})

test('compare objects with constructor properties', t => {
  t.true(isEqual({ constructor: 1 }, { constructor: 1 }))
  t.false(isEqual({ constructor: 1 }, { constructor: '1' }))
  t.true(isEqual({ constructor: [1] }, { constructor: [1] }))
  t.false(isEqual({ constructor: [1] }, { constructor: ['1'] }))
  t.false(isEqual({ constructor: Object }, {}))
})

test('compare arrays with circular references', t => {
  let array1 = []
  let array2 = []

  array1.push(array1)
  array2.push(array2)

  t.true(isEqual(array1, array2))

  array1.push('b')
  array2.push('b')

  t.true(isEqual(array1, array2))

  array1.push('c')
  array2.push('d')

  t.false(isEqual(array1, array2))

  array1 = ['a', 'b', 'c']
  array1[1] = array1
  array2 = ['a', ['a', 'b', 'c'], 'c']

  t.false(isEqual(array1, array2))
})

test('have transitive equivalence for circular references of arrays', t => {
  const array1 = []
  const array2 = [array1]
  const array3 = [array2]

  array1[0] = array1

  t.true(isEqual(array1, array2))
  t.true(isEqual(array2, array3))
  // Concordance detects a different circular reference in array1 before it does
  // in array3, making them unequal.
  t.false(isEqual(array1, array3))
})

test('compare objects with circular references', t => {
  let object1 = {}
  let object2 = {}

  object1.a = object1
  object2.a = object2

  t.true(isEqual(object1, object2))

  object1.b = 0
  object2.b = 0

  t.true(isEqual(object1, object2))

  object1.c = new Object(1)
  object2.c = new Object(2)

  t.false(isEqual(object1, object2))

  object1 = { a: 1, b: 2, c: 3 }
  object1.b = object1
  object2 = { a: 1, b: { a: 1, b: 2, c: 3 }, c: 3 }

  t.false(isEqual(object1, object2))
})

test('have transitive equivalence for circular references of objects', t => {
  const object1 = {}
  const object2 = { a: object1 }
  const object3 = { a: object2 }

  object1.a = object1

  t.true(isEqual(object1, object2))
  t.true(isEqual(object2, object3))
  // Concordance detects a different circular reference in object1 before it
  // does in object3, making them unequal.
  t.false(isEqual(object1, object3))
})

test('compare objects with multiple circular references', t => {
  const array1 = [{}]
  const array2 = [{}];

  (array1[0].a = array1).push(array1);
  (array2[0].a = array2).push(array2)

  t.true(isEqual(array1, array2))

  array1[0].b = 0
  array2[0].b = 0

  t.true(isEqual(array1, array2))

  array1[0].c = new Object(1)
  array2[0].c = new Object(2)

  t.false(isEqual(array1, array2))
})

test('compare objects with complex circular references', t => {
  const object1 = {
    foo: { b: { c: { d: {} } } },
    bar: { a: 2 },
  }

  const object2 = {
    foo: { b: { c: { d: {} } } },
    bar: { a: 2 },
  }

  object1.foo.b.c.d = object1
  object1.bar.b = object1.foo.b

  object2.foo.b.c.d = object2
  object2.bar.b = object2.foo.b

  t.true(isEqual(object1, object2))
})

test('compare objects with shared property values', t => {
  const object1 = {
    a: [1, 2],
  }

  const object2 = {
    a: [1, 2],
    b: [1, 2],
  }

  object1.b = object1.a

  t.true(isEqual(object1, object2))
})

test('treat objects created by `Object.create(null)` like plain objects', t => {
  function Foo () {
    this.a = 1
  }
  Foo.prototype.constructor = null

  const object1 = Object.create(null)
  object1.a = 1

  const object2 = { a: 1 }

  t.true(isEqual(object1, object2))
  t.false(isEqual(new Foo(), object2))
})

test('avoid common type coercions', t => {
  t.false(isEqual(true, new Object(false)))
  t.false(isEqual(new Object(false), new Object(0)))
  t.false(isEqual(false, new Object('')))
  t.false(isEqual(new Object(36), new Object('36')))
  t.false(isEqual(0, ''))
  t.false(isEqual(1, true))
  t.false(isEqual(1337756400000, new Date(2012, 4, 23)))
  t.false(isEqual('36', 36))
  t.false(isEqual(36, '36'))
})

test('compare `arguments` objects', t => {
  const args1 = (function () { return arguments }())
  const args2 = (function () { return arguments }())
  const args3 = (function () { return arguments }(1, 2))

  t.true(isEqual(args1, args2))
  t.false(isEqual(args1, args3))
})

test('actual `arguments` objects may be compared to expected arrays', t => {
  const array = [1, 2, 3]

  const args = (function () { return arguments })(1, 2, 3)
  t.true(isEqual(args, array))
  t.false(isEqual(array, args))
})

test('compare array buffers', t => {
  const buffer = new Int8Array([-1]).buffer

  t.true(isEqual(buffer, new Uint8Array([255]).buffer))
  t.false(isEqual(buffer, new ArrayBuffer(1)))
})

test('compare array views', t => {
  const arrayViews = [
    'Float32Array',
    'Float64Array',
    'Int8Array',
    'Int16Array',
    'Int32Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Uint16Array',
    'Uint32Array',
    'DataView',
  ]

  const namespaces = [global, realm]
  for (const ns of namespaces) {
    arrayViews.forEach((type, viewIndex) => {
      const otherType = arrayViews[(viewIndex + 1) % arrayViews.length]
      const CtorA = ns[type]
      const CtorB = ns[otherType]
      const bufferA = new ns.ArrayBuffer(8)
      const bufferB = new ns.ArrayBuffer(8)
      const bufferC = new ns.ArrayBuffer(16)

      t.true(isEqual(new CtorA(bufferA), new CtorA(bufferA)))
      t.false(isEqual(new CtorA(bufferA), new CtorB(bufferB)))
      t.false(isEqual(new CtorB(bufferB), new CtorB(bufferC)))
    })
  }
})

test('compare buffers', t => {
  const buffer = Buffer.from([1])

  t.true(isEqual(buffer, Buffer.from([1])))
  t.false(isEqual(buffer, Buffer.from([2])))
  t.false(isEqual(buffer, new Uint8Array([1])))
})

test('compare date objects', t => {
  const date = new Date(2012, 4, 23)

  t.true(isEqual(date, new Date(2012, 4, 23)))
  t.true(isEqual(new Date('a'), new Date('b')))
  t.false(isEqual(date, new Date(2013, 3, 25)))
  t.false(isEqual(date, { getTime () { return +date } }))
})

test('compare error objects', t => {
  const errorTypes = [
    'Error',
    'EvalError',
    'RangeError',
    'ReferenceError',
    'SyntaxError',
    'TypeError',
    'URIError',
  ]

  errorTypes.forEach((type, index) => {
    const otherType = errorTypes[++index % errorTypes.length]
    const CtorA = global[type]
    const CtorB = global[otherType]

    t.true(isEqual(new CtorA('a'), new CtorA('a')))
    t.false(isEqual(new CtorA('a'), new CtorB('a')))
    t.false(isEqual(new CtorB('a'), new CtorB('b')))
  })
})

test('compare functions', t => {
  function a () { return 1 + 2 }
  function b () { return 1 + 2 }

  t.true(isEqual(a, a))
  t.false(isEqual(a, b))
})

test('compare maps', t => {
  const map1 = new Map()
  for (const map2 of [new Map(), new realm.Map()]) {
    map1.set('a', 1)
    map2.set('b', 2)
    t.false(isEqual(map1, map2))

    map1.set('b', 2)
    map2.set('a', 1)
    t.false(isEqual(map1, map2))

    map1.delete('a')
    map1.set('a', 1)
    t.true(isEqual(map1, map2))

    map2.delete('a')
    t.false(isEqual(map1, map2))

    map1.clear()
    map2.clear()
  }
})

test('compare maps with circular references', t => {
  const map1 = new Map()
  const map2 = new Map()

  map1.set('a', map1)
  map2.set('a', map2)
  t.true(isEqual(map1, map2))

  map1.set('b', 1)
  map2.set('b', 2)
  t.false(isEqual(map1, map2))
})

test('compare promises by reference', t => {
  const promise1 = Promise.resolve(1)
  for (const promise2 of [Promise.resolve(1), realm.Promise.resolve(1)]) {
    t.false(isEqual(promise1, promise2))
    t.true(isEqual(promise1, promise1))
  }
})

test('compare regexes', t => {
  t.true(isEqual(/x/gim, /x/gim))
  t.true(isEqual(/x/gim, /x/gim))
  t.false(isEqual(/x/gi, /x/g))
  t.false(isEqual(/x/, /y/))
  t.false(isEqual(/x/g, { global: true, ignoreCase: false, multiline: false, source: 'x' }))
})

test('compare sets', t => {
  const set1 = new Set()
  for (const set2 of [new Set(), new realm.Set()]) {
    set1.add(1)
    set2.add(2)
    t.false(isEqual(set1, set2))

    set1.add(2)
    set2.add(1)
    t.false(isEqual(set1, set2))

    set1.delete(1)
    set1.add(1)
    t.true(isEqual(set1, set2))

    set2.delete(1)
    t.false(isEqual(set1, set2))

    set1.clear()
    set2.clear()
  }
})

test('compare sets with circular references', t => {
  const set1 = new Set()
  const set2 = new Set()

  set1.add(set1)
  set2.add(set2)
  t.true(isEqual(set1, set2))

  set1.add(1)
  set2.add(2)
  t.false(isEqual(set1, set2))
})

test('compare symbol properties', t => {
  const object1 = { a: 1 }
  const object2 = { a: 1 }

  object1[symbol1] = { a: { b: 2 } }
  object2[symbol1] = { a: { b: 2 } }

  Object.defineProperty(object2, symbol2, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: 2,
  })

  t.true(isEqual(object1, object2))

  object2[symbol1] = { a: 1 }
  t.false(isEqual(object1, object2))

  delete object2[symbol1]
  object2[Symbol('a')] = { a: { b: 2 } }
  t.false(isEqual(object1, object2))
})

test('return `true` for like-objects from different realms', t => {
  const array = new realm.Array()
  array.push(1)
  t.true(isEqual([1], array))
  t.false(isEqual([2], array))

  const object = new realm.Object()
  object.a = 1
  t.true(isEqual({ a: 1 }, object))
  t.false(isEqual({ a: 2 }, object))
})

test('return `false` for objects with custom `toString` methods', t => {
  let primitive
  const object = { 'toString' () { return primitive } }
  for (const value of [true, null, 1, 'a', undefined]) {
    primitive = value
    t.false(isEqual(object, value))
  }
})
