const test = require('ava')

const { diff, format } = require('..')

test('format() respects maxProperties', t => {
  t.is(format({ a: 1, b: 2, c: 3 }, { maxProperties: 1 }), `{
  a: 1,
  …,
}`)
})

test('format() respects maxItems', t => {
  t.is(format([1, 2, 3], { maxItems: 1 }), `[
  1,
  …,
]`)
})

test('diff() limits equal properties without hiding differences', t => {
  t.is(diff(
    { a: 1, b: 2, c: 3, z: 0 },
    { a: 1, b: 2, c: 3, z: 1 },
    { maxProperties: 1 },
  ), `  {
    a: 1,
    …,
-   z: 0,
+   z: 1,
  }`)
})

test('diff() limits equal items without hiding differences', t => {
  t.is(diff([1, 2, 3, 4], [1, 2, 3, 5], { maxItems: 1 }), `  [
    1,
    …,
-   4,
+   5,
  ]`)
})

test('maxItems applies to map entries', t => {
  t.is(format(new Map([['a', 1], ['b', 2]]), { maxItems: 1 }), `Map {
  'a' => 1,
  …,
}`)
})
