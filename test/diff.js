const test = require('ava')

const concordance = require('..')
const { diff: _diff } = require('../lib/diff')

const { theme, normalizedTheme, checkThemeUsage } = require('./_instrumentedTheme')

const diff = (actual, expected, { invert } = {}) => _diff(actual, expected, { invert, theme })
test.after(checkThemeUsage)

void (
  // Tested separately
  normalizedTheme.maxDepth
)

if (typeof BigInt === 'undefined') {
  void (
    normalizedTheme.bigInt.open,
    normalizedTheme.bigInt.close
  )
}

{
  const diffsPrimitives = (t, lhs, rhs) => t.snapshot(diff(lhs, rhs))
  diffsPrimitives.title = (_, lhs, rhs, lhsRepresentation = String(lhs), rhsRepresentation = String(rhs)) => {
    return `diffs primitives: ${lhsRepresentation} versus ${rhsRepresentation}`
  }
  for (const [lhs, rhs] of [
    [null, undefined],
    [null, false],
    [null, true],
    [null, ''],
    [null, 42],
    [null, Symbol()], // eslint-disable-line symbol-description
    [Symbol(), Symbol()], // eslint-disable-line symbol-description
    [null, {}],
  ]) {
    test(diffsPrimitives, lhs, rhs)
  }

  if (typeof BigInt === 'function') {
    test(diffsPrimitives, null, BigInt(42), 'null', '42n') // eslint-disable-line no-undef
  }
}

{
  const diffsBoxedPrimitives = (t, lhs, rhs) => t.snapshot(diff(new Object(lhs), new Object(rhs)))
  diffsBoxedPrimitives.title = (_, lhs, rhs, lhsRepresentation = String(lhs), rhsRepresentation = String(rhs)) => {
    return `diffs primitives: ${lhsRepresentation} versus ${rhsRepresentation}`
  }
  for (const [lhs, rhs] of [
    [true, false],
    [-42, 42],
    ['foo', 'bar'],
  ]) {
    test(diffsBoxedPrimitives, lhs, rhs)
  }

  if (typeof BigInt === 'function') {
    test(diffsBoxedPrimitives, BigInt(-42), BigInt(42), '-42n', '42n') // eslint-disable-line no-undef
  }
}

test('diffs boxed primitives with extra properties', t => {
  t.snapshot(diff(new Object('foo'), Object.assign(new Object('foo'), { bar: 'baz' })))
})

test('diffs single line strings', t => {
  const actual1 = diff('foo', 'bar')
  t.snapshot(actual1)

  const actual2 = diff('bar', 'baz')
  t.snapshot(actual2)
})

test('diffs multiline strings', t => {
  const actual1 = diff('foo\nbar', 'baz\nbar')
  t.snapshot(actual1)

  const actual2 = diff('foo\nbar', 'foo\nbaz')
  t.snapshot(actual2)

  const actual3 = diff('foo\nbar\nbaz', 'foo\nbaz')
  t.snapshot(actual3)

  const actual4 = diff('foo\nbaz', 'foo\nbar\nbaz')
  t.snapshot(actual4)

  const actual5 = diff('foo\n', 'foo\nbaz')
  t.snapshot(actual5)

  const actual6 = diff('foo\nbaz', 'foo\n')
  t.snapshot(actual6)

  const actual7 = diff('foo\nbar\nbaz', 'foo\n')
  t.snapshot(actual7)

  const actual8 = diff(`foo
bar
baz
qux
quux`, `corge
grault
baz
garply
quux`)
  t.snapshot(actual8)

  const actual9 = diff('foo\nbar\ncorge\nbaz\nqux\nquux\n', 'foo\nbar\nbaz\ngrault\nqux\nquux')
  t.snapshot(actual9)
})

test('diffs diverging complex types', t => {
  const actual = diff({ foo: 'bar' }, ['baz'])
  t.snapshot(actual)
})

{
  const mapArray = arr => arr
  const mapArguments = arr => { let args; (function () { args = arguments })(...arr); return args }
  const mapSet = arr => new Set(arr)

  const equalLength = (t, map) => {
    const actual1 = diff(map([1, 2, 4]), map([1, 3, 4]))
    t.snapshot(actual1)

    const actual2 = diff(
      map([1, { foo: 'bar' }, 2]),
      map([1, { baz: 'qux' }, 2]))
    t.snapshot(actual2)

    class Foo {
      constructor () {
        this.foo = 'foo'
      }
    }
    class Bar {
      constructor () {
        this.bar = 'bar'
      }
    }
    const actual3 = diff(
      map([new Foo()]),
      map([new Bar()]))
    t.snapshot(actual3)

    const actual4 = diff(
      map([Buffer.alloc(0)]),
      map([new Uint8Array()]))
    t.snapshot(actual4)

    const actual5 = diff(map([1, 2]), map([1]))
    t.snapshot(actual5)
  }
  test('diffs arrays', equalLength, mapArray)
  test('diffs arguments', equalLength, mapArguments)
  test('diffs sets', equalLength, mapSet)

  const extraneous = (t, map) => {
    const actual1 = diff(map([1, 3, 2]), map([1, 2]))
    t.snapshot(actual1)

    const actual2 = diff(map([1, {}, 2]), map([1, 2]))
    t.snapshot(actual2)

    const actual3 = diff(
      map([1, { foo: 'bar' }, { baz: 'qux' }, 2]),
      map([1, { baz: 'qux' }, 2]))
    t.snapshot(actual3)

    const s1 = Symbol('s1')
    const s2 = Symbol('s2')
    const actual4 = diff(
      map([1, { [s1]: 'bar' }, { [s2]: 'qux' }, 2]),
      map([1, { [s2]: 'qux' }, 2]))
    t.snapshot(actual4)
  }
  test('detects extraneous array items', extraneous, mapArray)
  test('detects extraneous arguments items', extraneous, mapArguments)
  test('detects extraneous set items', extraneous, mapSet)

  const missing = (t, map) => {
    const actual1 = diff(map([1, 2]), map([1, 3, 2]))
    t.snapshot(actual1)

    const actual2 = diff(map([1, 2]), map([1, {}, 2]))
    t.snapshot(actual2)

    const actual3 = diff(
      map([1, { baz: 'qux' }, 2]),
      map([1, { foo: 'bar' }, { baz: 'qux' }, 2]))
    t.snapshot(actual3)

    const s1 = Symbol('s1')
    const s2 = Symbol('s2')
    const actual4 = diff(
      map([1, { [s2]: 'qux' }, 2]),
      map([1, { [s1]: 'bar' }, { [s2]: 'qux' }, 2]))
    t.snapshot(actual4)
  }
  test('detects missing array items', missing, mapArray)
  test('detects missing arguments items', missing, mapArguments)
  test('detects missing set items', missing, mapSet)
}

test('detects extraneous name properties', t => {
  const actual1 = diff(
    { a: 1, b: 2, c: 3 },
    { a: 1, c: 3 })
  t.snapshot(actual1)

  const actual2 = diff(
    { a: 1, b: {}, c: 3 },
    { a: 1, c: 3 })
  t.snapshot(actual2)
})

test('detects missing name properties', t => {
  const actual1 = diff(
    { a: 1, c: 3 },
    { a: 1, b: 2, c: 3 })
  t.snapshot(actual1)

  const actual2 = diff(
    { a: 1, c: 3 },
    { a: 1, b: {}, c: 3 })
  t.snapshot(actual2)
})

test('detects extraneous symbol properties', t => {
  const s1 = Symbol('s1')
  const s2 = Symbol('s2')
  const s3 = Symbol('s3')
  const actual1 = diff(
    { [s1]: 1, [s2]: 2, [s3]: 3 },
    { [s1]: 1, [s3]: 3 })
  t.snapshot(actual1)

  const actual2 = diff(
    { [s1]: 1, [s2]: {}, [s3]: 3 },
    { [s1]: 1, [s3]: 3 })
  t.snapshot(actual2)
})

test('detects missing symbol properties', t => {
  const s1 = Symbol('s1')
  const s2 = Symbol('s2')
  const s3 = Symbol('s3')
  const actual1 = diff(
    { [s1]: 1, [s3]: 3 },
    { [s1]: 1, [s2]: 2, [s3]: 3 })
  // Note that when symbol properties are sorted, they're sorted according to
  // their order in the actual value. Missing properties will end up at the
  // bottom.
  t.snapshot(actual1)

  const actual2 = diff(
    { [s1]: 1, [s3]: 3 },
    { [s1]: 1, [s2]: {}, [s3]: 3 })
  t.snapshot(actual2)
})

test('diffs maps', t => {
  const actual1 = diff(
    new Map([[1, 1], [2, 2], [4, 4]]),
    new Map([[1, 1], [3, 3], [4, 4]]))
  t.snapshot(actual1)

  const actual2 = diff(
    new Map([[1, 1], [{ foo: 'bar' }, 2], [4, 4]]),
    new Map([[1, 1], [{ baz: 'qux' }, 2], [4, 4]]))
  t.snapshot(actual2)

  const actual3 = diff(
    new Map([[1, 1], [{ foo: 'bar' }, 2], [4, 4]]),
    new Map([[1, 1], [{ baz: 'qux' }, 3], [4, 4]]))
  t.snapshot(actual3)
})

test('detects extraneous map entries', t => {
  const actual1 = diff(
    new Map([[1, 1], [3, 3], [2, 2]]),
    new Map([[1, 1], [2, 2]]))
  t.snapshot(actual1)

  const actual2 = diff(
    new Map([[1, 1], [{}, 3], [2, 2]]),
    new Map([[1, 1], [2, 2]]))
  t.snapshot(actual2)

  const actual3 = diff(
    new Map([[1, 1], [{ foo: 'bar' }, 4], [{ baz: 'qux' }, 2], [3, 3]]),
    new Map([[1, 1], [{ baz: 'qux' }, 2], [3, 3]]))
  t.snapshot(actual3)

  const s1 = Symbol('s1')
  const s2 = Symbol('s2')
  const actual4 = diff(
    new Map([[1, 1], [{ [s1]: 'bar' }, 4], [{ [s2]: 'qux' }, 2], [3, 3]]),
    new Map([[1, 1], [{ [s2]: 'qux' }, 2], [3, 3]]))
  t.snapshot(actual4)
})

test('detects missing map entries', t => {
  const actual1 = diff(
    new Map([[1, 1], [2, 2]]),
    new Map([[1, 1], [3, 3], [2, 2]]))
  t.snapshot(actual1)

  const actual2 = diff(
    new Map([[1, 1], [2, 2]]),
    new Map([[1, 1], [{}, 3], [2, 2]]))
  t.snapshot(actual2)

  const actual3 = diff(
    new Map([[1, 1], [{ baz: 'qux' }, 2], [3, 3]]),
    new Map([[1, 1], [{ foo: 'bar' }, 4], [{ baz: 'qux' }, 2], [3, 3]]))
  t.snapshot(actual3)

  const s1 = Symbol('s1')
  const s2 = Symbol('s2')
  const actual4 = diff(
    new Map([[1, 1], [{ [s2]: 'qux' }, 2], [3, 3]]),
    new Map([[1, 1], [{ [s1]: 'bar' }, 4], [{ [s2]: 'qux' }, 2], [3, 3]]))
  t.snapshot(actual4)
})

test('diffs maps with extra properties', t => {
  const actual1 = diff(new Map([['foo', 'bar']]), Object.assign(new Map([['foo', 'bar']]), { baz: 'qux' }))
  t.snapshot(actual1)

  const actual2 = diff(Object.assign(new Map([['foo', 'bar']]), { baz: 'qux' }), new Map([['foo', 'bar']]))
  t.snapshot(actual2)
})

test('diffs multiline string values in objects', t => {
  const actual1 = diff({ foo: 'bar\nbaz' }, { foo: 'qux\nbaz' })
  t.snapshot(actual1)

  const actual2 = diff({ foo: 'bar\nbaz\nqux' }, { foo: 'bar\nqux\nbaz' })
  t.snapshot(actual2)

  const s1 = Symbol('s1')
  const actual3 = diff({ [s1]: 'bar\nbaz' }, { [s1]: 'qux\nbaz' })
  t.snapshot(actual3)
})

test('diffs multiline string values in arrays', t => {
  const actual = diff(['foo\nbar'], ['baz\nbar'])
  t.snapshot(actual)
})

test('diffs multiline string values in sets', t => {
  const actual = diff(new Set(['foo\nbar']), new Set(['baz\nbar']))
  t.snapshot(actual)
})

test('diffs multiline string values in maps when key is primitive', t => {
  const actual1 = diff(new Map([[1, 'foo\nbar']]), new Map([[1, 'baz\nbar']]))
  t.snapshot(actual1)

  const actual2 = diff(new Map([['foo\nbar', 'foo\nbar']]), new Map([['foo\nbar', 'baz\nbar']]))
  t.snapshot(actual2)

  const actual3 = diff(new Map([['foo', 'bar\nbaz\nqux']]), new Map([['foo', 'bar\nqux\nbaz']]))
  t.snapshot(actual3)
})

test('does not diff multiline string values in maps when key is complex', t => {
  const actual = diff(new Map([[{}, 'foo\nbar']]), new Map([[{}, 'baz\nbar']]))
  t.snapshot(actual)
})

test('diffs properties with different values', t => {
  class Foo { constructor () { this.value = 42 } }
  class Bar { constructor () { this.value = 42 } }
  const actual1 = diff({ value: new Foo() }, { value: new Bar() })
  t.snapshot(actual1)

  const actual2 = diff({ value: new Foo() }, { value: 42 })
  t.snapshot(actual2)

  const actual3 = diff({ value: new Foo() }, { value: 'foo\nbar' })
  t.snapshot(actual3)

  const actual4 = diff({ foo: 'bar' }, { foo: 'not bar' })
  t.snapshot(actual4)
})

test('diffs map keys with different values', t => {
  class Foo { constructor () { this.value = 42 } }
  class Bar { constructor () { this.value = 42 } }
  const actual1 = diff(new Map([['key', new Foo()]]), new Map([['key', new Bar()]]))
  t.snapshot(actual1)

  const actual2 = diff(new Map([['key', new Foo()]]), new Map([['key', 42]]))
  t.snapshot(actual2)

  const actual3 = diff(new Map([['key', new Foo()]]), new Map([['key', 'foo\nbar']]))
  t.snapshot(actual3)

  const actual4 = diff(new Map([['key\nline', new Foo()]]), new Map([['key\nline', new Bar()]]))
  t.snapshot(actual4)
})

test('diffs circular references', t => {
  const obj1 = { obj: {} }
  obj1.obj.obj = obj1
  const obj2 = {}
  obj2.obj = obj2
  t.snapshot(diff(obj1, obj2))

  obj2.obj = obj1
  t.snapshot(diff(obj1, obj2))

  const arr1 = [[]]
  arr1[0][0] = arr1
  const arr2 = []
  arr2[0] = arr1
  t.snapshot(diff(arr1, arr2))

  const map1 = new Map([['map', new Map()]])
  map1.get('map').set('map', map1)
  const map2 = new Map()
  map2.set('map', map1)
  t.snapshot(diff(map1, map2))

  const key = { key: true }
  const map3 = new Map([[key, new Map()]])
  map3.get(key).set(key, map3)
  const map4 = new Map()
  map4.set(key, map3)
  t.snapshot(diff(map3, map4))
})

test('diff invalid dates', t => {
  t.snapshot(diff(new Date('🚀🌔🛬'), new Date('🚀💥💧')))
})

test('diff dates with extra properties', t => {
  const actual = diff(new Date('1969-07-20T20:17:40.000Z'), Object.assign(new Date('1969-07-21T20:17:40.000Z'), {
    foo: 'bar',
  }))
  t.snapshot(actual)
})

test('diffs errors', t => {
  class Custom extends Error {} // eslint-disable-line unicorn/custom-error-definition
  t.snapshot(diff(new Custom(), new Error()))
})

test('diffs functions', t => {
  t.snapshot(diff(function foo () {}, function bar () {}))
})

test('diffs globals', t => {
  t.snapshot(diff(global, global))
})

test('diffs objects without constructor', t => {
  const obj = {}
  Object.defineProperty(obj, 'constructor', {})
  t.snapshot(diff(obj, {}))
})

test('diffs builtin subclasses', t => {
  class Foo extends Array {}
  t.snapshot(diff(new Foo(), []))
})

test('diffs regexps', t => {
  t.snapshot(diff(/foo/, /foo/g))
  t.snapshot(diff(/foo/, Object.assign(/foo/, { bar: 'baz' })))
})

test('diffs buffers', t => {
  t.snapshot(diff(Buffer.from('decafbad', 'hex'), Buffer.from('flat white', 'utf8')))
})

test('inverted diffs', t => {
  t.snapshot(diff({
    foo: 'bar',
    baz: 'qux\nquux\ncorge',
  }, {
    foo: 'BAR',
    baz: 'qux\ncorge\nquux',
  }, { invert: true }))
})

test('inverts string diffs', t => {
  t.snapshot(diff('foo', 'bar', { invert: true }))
  t.snapshot(diff('foo bar baz', 'foo baz quux', { invert: true }))
  t.snapshot(diff('foo\nbar\nbaz', 'foobarbaz', { invert: true }))
})

test('inverts string diffs in containers', t => {
  const actual = 'foo\nbar\nbaz'
  const expected = 'foo\nbaz\nquux'

  t.snapshot(diff({ a: actual }, { a: expected }, { invert: true }))
  t.snapshot(diff([actual], [expected], { invert: true }))
  t.snapshot(diff(new Map().set('a', actual), new Map().set('a', expected), { invert: true }))
  t.snapshot(diff(new Set().add(actual), new Set().add(expected), { invert: true }))
  t.snapshot(diff(new String(actual), new String(expected), { invert: true })) // eslint-disable-line unicorn/new-for-builtins, no-new-wrappers

  t.snapshot(diff({ a: { b: actual } }, { a: { b: expected } }, { invert: true }))
})

test('lists: effectively resets depth when formatting differences', t => {
  const l1 = [
    {
      b: 'b',
    },
    {
      d: 'bar',
      e: {
        f: 'f',
      },
    },
  ]
  const l2 = [
    {
      b: 'b',
    },
  ]
  t.snapshot(_diff(l1, l2, { maxDepth: 1, theme }))
})

test('objects: effectively resets depth when formatting differences', t => {
  const o1 = {
    a: {
      b: 'b',
    },
    c: {
      d: 'bar',
      e: {
        f: 'f',
      },
    },
  }
  const o2 = {
    a: {
      b: 'b',
    },
  }
  t.snapshot(_diff(o1, o2, { maxDepth: 1, theme }))
})

// See <https://github.com/concordancejs/concordance/issues/66>.
test('diff pointers hidden behind maxDepth', t => {
  const value = {}
  const descriptor = concordance.describe({
    // `value` is encoded in the serialization of `a.b`. `c` is encoded as a
    // pointer to the encoded `value`.
    a: {
      b: value,
    },
    c: value,
  })
  const serialized = concordance.serialize(descriptor)

  t.notThrows(() => {
    // `maxDepth: 1` means that `a.b` is not normally deserialized, and so the
    // `c` pointer cannot be resolved, unless the resolution logic first
    // deserializes the descriptor in its entirety.
    concordance.diffDescriptors(concordance.deserialize(serialized), concordance.describe(undefined), { maxDepth: 1 })
  })
})
