import styles from 'ansi-styles'
import test from 'ava'

import {diff} from '../lib/diff'

function u (strings) {
  return styles.underline.open + strings[0] + styles.underline.close
}

test('diffs primitives', t => {
  for (const [lhs, rhs, expected] of [
    [null, undefined, '- null\n+ undefined'],
    [null, false, '- null\n+ false'],
    [null, true, '- null\n+ true'],
    [null, '', '- null\n+ \'\''],
    [null, 42, '- null\n+ 42'],
    [null, Symbol(), '- null\n+ Symbol()'], // eslint-disable-line symbol-description
    [Symbol(), Symbol(), '- Symbol()\n+ Symbol()'], // eslint-disable-line symbol-description
    [null, {}, '- null\n+ Object {}']
  ]) {
    const actual = diff(lhs, rhs)
    t.is(actual, expected)
  }
})

test('diffs wrapped primitives', t => {
  for (const [lhs, rhs, expected] of [
    [true, false, '- Boolean {\n-   true\n- }\n+ Boolean {\n+   false\n+ }'],
    [-42, 42, '- Number {\n-   -42\n- }\n+ Number {\n+   42\n+ }']
  ]) {
    const actual = diff(Object(lhs), Object(rhs))
    t.is(actual, expected)
  }
})

test('diffs single line strings', t => {
  const actual1 = diff('foo', 'bar')
  t.is(actual1, `- 'foo'
+ 'bar'`)

  const actual2 = diff('bar', 'baz')
  t.is(actual2, `- 'ba${u`r`}'
+ 'ba${u`z`}'`)
})

test('diffs multiline strings', t => {
  const actual1 = diff('foo\nbar', 'baz\nbar')
  t.is(actual1, `- \`foo\u240A
+ \`baz\u240A
  bar\``)

  const actual2 = diff('foo\nbar', 'foo\nbaz')
  t.is(actual2, `  \`foo\u240A
- bar\`
+ baz\``)

  const actual3 = diff('foo\nbar\nbaz', 'foo\nbaz')
  t.is(actual3, `  \`foo\u240A
- bar\u240A
  baz\``)

  const actual4 = diff('foo\nbaz', 'foo\nbar\nbaz')
  t.is(actual4, `  \`foo\u240A
+ bar\u240A
  baz\``)

  const actual5 = diff('foo\n', 'foo\nbaz')
  t.is(actual5, `  \`foo\u240A
- \`
+ ${u`baz`}\``)

  const actual6 = diff('foo\nbaz', 'foo\n')
  t.is(actual6, `  \`foo\u240A
- ${u`baz`}\`
+ \``)

  const actual7 = diff('foo\nbar\nbaz', 'foo\n')
  t.is(actual7, `  \`foo\u240A
- bar\u240A
- ${u`baz`}\`
+ \``)

  const actual8 = diff(`foo
bar
baz
qux
quux`, `corge
grault
baz
garply
quux`)
  t.is(actual8, `- \`${u`fo`}o\u240A
- ${u`b`}a${u`r`}\u240A
+ \`${u`c`}o${u`rge`}\u240A
+ ${u`gr`}a${u`ult`}\u240A
  baz\u240A
- ${u`qux`}\u240A
+ ${u`garply`}\u240A
  quux\``)
})

test('diffs diverging complex types', t => {
  const actual = diff({ foo: 'bar' }, ['baz'])
  t.is(actual, `- Object {
-   foo: 'bar',
- }
+ Array [
+   'baz',
+ ]`)
})

{
  const arrayArgs = [arr => arr, 'Array [', ']']
  const argumentsArgs = [arr => { let args; (function () { args = arguments })(...arr); return args }, 'Arguments [', ']']
  const setArgs = [arr => new Set(arr), 'Set {', '}']

  const equalLength = (t, map, open, close) => {
    const actual1 = diff(map([1, 2, 4]), map([1, 3, 4]))
    t.is(actual1, `  ${open}
    1,
-   2,
+   3,
    4,
  ${close}`)

    const actual2 = diff(
      map([1, {foo: 'bar'}, 2]),
      map([1, {baz: 'qux'}, 2]))
    t.is(actual2, `  ${open}
    1,
    Object {
-     foo: 'bar',
+     baz: 'qux',
    },
    2,
  ${close}`)
  }
  test('diffs arrays', equalLength, ...arrayArgs)
  test('diffs arguments', equalLength, ...argumentsArgs)
  test('diffs sets', equalLength, ...setArgs)

  const extraneous = (t, map, open, close) => {
    const actual1 = diff(map([1, 3, 2]), map([1, 2]))
    t.is(actual1, `  ${open}
    1,
-   3,
    2,
  ${close}`)

    const actual2 = diff(map([1, {}, 2]), map([1, 2]))
    t.is(actual2, `  ${open}
    1,
-   Object {},
    2,
  ${close}`)

    const actual3 = diff(
      map([1, {foo: 'bar'}, {baz: 'qux'}, 2]),
      map([1, {baz: 'qux'}, 2]))
    t.is(actual3, `  ${open}
    1,
-   Object {
-     foo: 'bar',
-   },
    Object {
      baz: 'qux',
    },
    2,
  ${close}`)

    const s1 = Symbol('s1')
    const s2 = Symbol('s2')
    const actual4 = diff(
      map([1, {[s1]: 'bar'}, {[s2]: 'qux'}, 2]),
      map([1, {[s2]: 'qux'}, 2]))
    t.is(actual4, `  ${open}
    1,
-   Object {
-     [Symbol(s1)]: 'bar',
-   },
    Object {
      [Symbol(s2)]: 'qux',
    },
    2,
  ${close}`)
  }
  test('detects extraneous array items', extraneous, ...arrayArgs)
  test('detects extraneous arguments items', extraneous, ...argumentsArgs)
  test('detects extraneous set items', extraneous, ...setArgs)

  const missing = (t, map, open, close) => {
    const actual1 = diff(map([1, 2]), map([1, 3, 2]))
    t.is(actual1, `  ${open}
    1,
+   3,
    2,
  ${close}`)

    const actual2 = diff(map([1, 2]), map([1, {}, 2]))
    t.is(actual2, `  ${open}
    1,
+   Object {},
    2,
  ${close}`)

    const actual3 = diff(
      map([1, {baz: 'qux'}, 2]),
      map([1, {foo: 'bar'}, {baz: 'qux'}, 2]))
    t.is(actual3, `  ${open}
    1,
+   Object {
+     foo: 'bar',
+   },
    Object {
      baz: 'qux',
    },
    2,
  ${close}`)

    const s1 = Symbol('s1')
    const s2 = Symbol('s2')
    const actual4 = diff(
      map([1, {[s2]: 'qux'}, 2]),
      map([1, {[s1]: 'bar'}, {[s2]: 'qux'}, 2]))
    t.is(actual4, `  ${open}
    1,
+   Object {
+     [Symbol(s1)]: 'bar',
+   },
    Object {
      [Symbol(s2)]: 'qux',
    },
    2,
  ${close}`)
  }
  test('detects missing array items', missing, ...arrayArgs)
  test('detects missing arguments items', missing, ...argumentsArgs)
  test('detects missing set items', missing, ...setArgs)
}

test('detects extraneous name properties', t => {
  const actual1 = diff(
    {a: 1, b: 2, c: 3},
    {a: 1, c: 3})
  t.is(actual1, `  Object {
    a: 1,
-   b: 2,
    c: 3,
  }`)

  const actual2 = diff(
    {a: 1, b: {}, c: 3},
    {a: 1, c: 3})
  t.is(actual2, `  Object {
    a: 1,
-   b: Object {},
    c: 3,
  }`)
})

test('detects missing name properties', t => {
  const actual1 = diff(
    {a: 1, c: 3},
    {a: 1, b: 2, c: 3})
  t.is(actual1, `  Object {
    a: 1,
+   b: 2,
    c: 3,
  }`)

  const actual2 = diff(
    {a: 1, c: 3},
    {a: 1, b: {}, c: 3})
  t.is(actual2, `  Object {
    a: 1,
+   b: Object {},
    c: 3,
  }`)
})

test('detects extraneous symbol properties', t => {
  const s1 = Symbol('s1')
  const s2 = Symbol('s2')
  const s3 = Symbol('s3')
  const actual1 = diff(
    {[s1]: 1, [s2]: 2, [s3]: 3},
    {[s1]: 1, [s3]: 3})
  t.is(actual1, `  Object {
    [Symbol(s1)]: 1,
-   [Symbol(s2)]: 2,
    [Symbol(s3)]: 3,
  }`)

  const actual2 = diff(
    {[s1]: 1, [s2]: {}, [s3]: 3},
    {[s1]: 1, [s3]: 3})
  t.is(actual2, `  Object {
    [Symbol(s1)]: 1,
-   [Symbol(s2)]: Object {},
    [Symbol(s3)]: 3,
  }`)
})

test('detects missing symbol properties', t => {
  const s1 = Symbol('s1')
  const s2 = Symbol('s2')
  const s3 = Symbol('s3')
  const actual1 = diff(
    {[s1]: 1, [s3]: 3},
    {[s1]: 1, [s2]: 2, [s3]: 3})
  // Note that when symbol properties are sorted, they're sorted according to
  // their order in the actual value. Missing properties will end up at the
  // bottom.
  t.is(actual1, `  Object {
    [Symbol(s1)]: 1,
    [Symbol(s3)]: 3,
+   [Symbol(s2)]: 2,
  }`)

  const actual2 = diff(
    {[s1]: 1, [s3]: 3},
    {[s1]: 1, [s2]: {}, [s3]: 3})
  t.is(actual2, `  Object {
    [Symbol(s1)]: 1,
    [Symbol(s3)]: 3,
+   [Symbol(s2)]: Object {},
  }`)
})

test('diffs maps', t => {
  const actual1 = diff(
    new Map([[1, 1], [2, 2], [4, 4]]),
    new Map([[1, 1], [3, 3], [4, 4]]))
  t.is(actual1, `  Map {
    1 => 1,
-   2 => 2,
+   3 => 3,
    4 => 4,
  }`)

  const actual2 = diff(
    new Map([[1, 1], [{foo: 'bar'}, 2], [4, 4]]),
    new Map([[1, 1], [{baz: 'qux'}, 2], [4, 4]]))
  t.is(actual2, `  Map {
    1 => 1,
    Object {
-     foo: 'bar',
+     baz: 'qux',
    } => 2,
    4 => 4,
  }`)

  const actual3 = diff(
    new Map([[1, 1], [{foo: 'bar'}, 2], [4, 4]]),
    new Map([[1, 1], [{baz: 'qux'}, 3], [4, 4]]))
  t.is(actual3, `  Map {
    1 => 1,
-   Object {
-     foo: 'bar',
-   } => 2,
+   Object {
+     baz: 'qux',
+   } => 3,
    4 => 4,
  }`)
})

test('detects extraneous map entries', t => {
  const actual1 = diff(
    new Map([[1, 1], [3, 3], [2, 2]]),
    new Map([[1, 1], [2, 2]]))
  t.is(actual1, `  Map {
    1 => 1,
-   3 => 3,
    2 => 2,
  }`)

  const actual2 = diff(
    new Map([[1, 1], [{}, 3], [2, 2]]),
    new Map([[1, 1], [2, 2]]))
  t.is(actual2, `  Map {
    1 => 1,
-   Object {} => 3,
    2 => 2,
  }`)

  const actual3 = diff(
    new Map([[1, 1], [{foo: 'bar'}, 4], [{baz: 'qux'}, 2], [3, 3]]),
    new Map([[1, 1], [{baz: 'qux'}, 2], [3, 3]]))
  t.is(actual3, `  Map {
    1 => 1,
-   Object {
-     foo: 'bar',
-   } => 4,
    Object {
      baz: 'qux',
    } => 2,
    3 => 3,
  }`)

  const s1 = Symbol('s1')
  const s2 = Symbol('s2')
  const actual4 = diff(
    new Map([[1, 1], [{[s1]: 'bar'}, 4], [{[s2]: 'qux'}, 2], [3, 3]]),
    new Map([[1, 1], [{[s2]: 'qux'}, 2], [3, 3]]))
  t.is(actual4, `  Map {
    1 => 1,
-   Object {
-     [Symbol(s1)]: 'bar',
-   } => 4,
    Object {
      [Symbol(s2)]: 'qux',
    } => 2,
    3 => 3,
  }`)
})

test('detects missing map entries', t => {
  const actual1 = diff(
    new Map([[1, 1], [2, 2]]),
    new Map([[1, 1], [3, 3], [2, 2]]))
  t.is(actual1, `  Map {
    1 => 1,
+   3 => 3,
    2 => 2,
  }`)

  const actual2 = diff(
    new Map([[1, 1], [2, 2]]),
    new Map([[1, 1], [{}, 3], [2, 2]]))
  t.is(actual2, `  Map {
    1 => 1,
+   Object {} => 3,
    2 => 2,
  }`)

  const actual3 = diff(
    new Map([[1, 1], [{baz: 'qux'}, 2], [3, 3]]),
    new Map([[1, 1], [{foo: 'bar'}, 4], [{baz: 'qux'}, 2], [3, 3]]))
  t.is(actual3, `  Map {
    1 => 1,
+   Object {
+     foo: 'bar',
+   } => 4,
    Object {
      baz: 'qux',
    } => 2,
    3 => 3,
  }`)

  const s1 = Symbol('s1')
  const s2 = Symbol('s2')
  const actual4 = diff(
    new Map([[1, 1], [{[s2]: 'qux'}, 2], [3, 3]]),
    new Map([[1, 1], [{[s1]: 'bar'}, 4], [{[s2]: 'qux'}, 2], [3, 3]]))
  t.is(actual4, `  Map {
    1 => 1,
+   Object {
+     [Symbol(s1)]: 'bar',
+   } => 4,
    Object {
      [Symbol(s2)]: 'qux',
    } => 2,
    3 => 3,
  }`)
})

test('diffs maps with extra properties', t => {
  const actual1 = diff(new Map([['foo', 'bar']]), Object.assign(new Map([['foo', 'bar']]), {baz: 'qux'}))
  t.is(actual1, `  Map {
+   baz: 'qux',
    ---
    'foo' => 'bar',
  }`)

  const actual2 = diff(Object.assign(new Map([['foo', 'bar']]), {baz: 'qux'}), new Map([['foo', 'bar']]))
  t.is(actual2, `  Map {
-   baz: 'qux',
    ---
    'foo' => 'bar',
  }`)
})

test('diffs multiline string values in objects', t => {
  const actual1 = diff({foo: 'bar\nbaz'}, {foo: 'qux\nbaz'})
  t.is(actual1, `  Object {
-   foo: \`bar\u240A
+   foo: \`qux\u240A
    baz\`,
  }`)

  const actual2 = diff({foo: 'bar\nbaz\nqux'}, {foo: 'bar\nqux\nbaz'})
  t.is(actual2, `  Object {
    foo: \`bar\u240A
-   ${u`baz`}\u240A
-   ${u`qux`}\`,
+   ${u`qux`}\u240A
+   ${u`baz`}\`,
  }`)

  const s1 = Symbol('s1')
  const actual3 = diff({[s1]: 'bar\nbaz'}, {[s1]: 'qux\nbaz'})
  t.is(actual3, `  Object {
-   [Symbol(s1)]: \`bar\u240A
+   [Symbol(s1)]: \`qux\u240A
    baz\`,
  }`)
})

test('diffs multiline string values in arrays', t => {
  const actual = diff(['foo\nbar'], ['baz\nbar'])
  t.is(actual, `  Array [
-   \`foo\u240A
-   bar\`,
+   \`baz\u240A
+   bar\`,
  ]`)
})

test('diffs multiline string values in sets', t => {
  const actual = diff(new Set(['foo\nbar']), new Set(['baz\nbar']))
  t.is(actual, `  Set {
-   \`foo\u240A
-   bar\`,
+   \`baz\u240A
+   bar\`,
  }`)
})

test('diffs multiline string values in maps when key is primitive', t => {
  const actual1 = diff(new Map([[1, 'foo\nbar']]), new Map([[1, 'baz\nbar']]))
  t.is(actual1, `  Map {
-   1 => \`foo\u240A
+   1 => \`baz\u240A
    bar\`,
  }`)

  const actual2 = diff(new Map([['foo\nbar', 'foo\nbar']]), new Map([['foo\nbar', 'baz\nbar']]))
  t.is(actual2, `  Map {
-   \`foo\u240A
-   bar\` => \`foo\u240A
+   \`foo\u240A
+   bar\` => \`baz\u240A
    bar\`,
  }`)

  const actual3 = diff(new Map([['foo', 'bar\nbaz\nqux']]), new Map([['foo', 'bar\nqux\nbaz']]))
  t.is(actual3, `  Map {
    'foo' => \`bar\u240A
-   ${u`baz`}\u240A
-   ${u`qux`}\`,
+   ${u`qux`}\u240A
+   ${u`baz`}\`,
  }`)
})

test('does not diff multiline string values in maps when key is complex', t => {
  const actual = diff(new Map([[{}, 'foo\nbar']]), new Map([[{}, 'baz\nbar']]))
  t.is(actual, `  Map {
-   Object {} => \`foo\u240A
-   bar\`,
+   Object {} => \`baz\u240A
+   bar\`,
  }`)
})

test('diffs properties with different values', t => {
  class Foo { constructor () { this.value = 42 } }
  class Bar { constructor () { this.value = 42 } }
  const actual1 = diff({ value: new Foo() }, { value: new Bar() })
  t.is(actual1, `  Object {
-   value: Foo {
-     value: 42,
-   },
+   value: Bar {
+     value: 42,
+   },
  }`)

  const actual2 = diff({ value: new Foo() }, { value: 42 })
  t.is(actual2, `  Object {
-   value: Foo {
-     value: 42,
-   },
+   value: 42,
  }`)

  const actual3 = diff({ value: new Foo() }, { value: 'foo\nbar' })
  t.is(actual3, `  Object {
-   value: Foo {
-     value: 42,
-   },
+   value: \`foo\u240A
+   bar\`,
  }`)

  const actual4 = diff({ foo: 'bar' }, { foo: 'not bar' })
  t.is(actual4, `  Object {
-   foo: 'bar',
+   foo: '${u`not `}bar',
  }`)
})

test('diffs map keys with different values', t => {
  class Foo { constructor () { this.value = 42 } }
  class Bar { constructor () { this.value = 42 } }
  const actual1 = diff(new Map([['key', new Foo()]]), new Map([['key', new Bar()]]))
  t.is(actual1, `  Map {
-   'key' => Foo {
-     value: 42,
-   },
+   'key' => Bar {
+     value: 42,
+   },
  }`)

  const actual2 = diff(new Map([['key', new Foo()]]), new Map([['key', 42]]))
  t.is(actual2, `  Map {
-   'key' => Foo {
-     value: 42,
-   },
+   'key' => 42,
  }`)

  const actual3 = diff(new Map([['key', new Foo()]]), new Map([['key', 'foo\nbar']]))
  t.is(actual3, `  Map {
-   'key' => Foo {
-     value: 42,
-   },
+   'key' => \`foo\u240A
+   bar\`,
  }`)

  const actual4 = diff(new Map([['key\nline', new Foo()]]), new Map([['key\nline', new Bar()]]))
  t.is(actual4, `  Map {
-   \`key\u240A
-   line\` => Foo {
-     value: 42,
-   },
+   \`key\u240A
+   line\` => Bar {
+     value: 42,
+   },
  }`)
})

test('diffs circular references', t => {
  const obj1 = { obj: {} }
  obj1.obj.obj = obj1
  const obj2 = {}
  obj2.obj = obj2
  t.is(diff(obj1, obj2), `  Object {
    obj: Object {
      obj: [Circular],
    },
  }`)

  obj2.obj = obj1
  t.is(diff(obj1, obj2), `  Object {
    obj: Object {
      obj: Object {
-       obj: [Circular],
+       obj: [Circular],
      },
    },
  }`)

  const arr1 = [[]]
  arr1[0][0] = arr1
  const arr2 = []
  arr2[0] = arr1
  t.is(diff(arr1, arr2), `  Array [
    Array [
      Array [
-       [Circular],
+       [Circular],
      ],
    ],
  ]`)

  const map1 = new Map([['map', new Map()]])
  map1.get('map').set('map', map1)
  const map2 = new Map()
  map2.set('map', map1)
  t.is(diff(map1, map2), `  Map {
    'map' => Map {
      'map' => Map {
-       'map' => [Circular],
+       'map' => [Circular],
      },
    },
  }`)

  const key = {key: true}
  const map3 = new Map([[key, new Map()]])
  map3.get(key).set(key, map3)
  const map4 = new Map()
  map4.set(key, map3)
  t.is(diff(map3, map4), `  Map {
    Object {
      key: true,
    } => Map {
-     Object {
-       key: true,
-     } => [Circular],
+     Object {
+       key: true,
+     } => Map {
+       Object {
+         key: true,
+       } => [Circular],
+     },
    },
  }`)
})
