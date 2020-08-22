const test = require('ava')

const { compare } = require('../lib/compare')

test('compare functions by reference', t => {
  function a () { return 1 + 2 } // eslint-disable-line unicorn/consistent-function-scoping
  const a_ = (() => {
    return function a () { return 1 + 2 } // eslint-disable-line no-shadow
  })()

  t.false(compare(a, a_).pass)
})

test('compare function by names', t => {
  function a () { return 1 + 2 } // eslint-disable-line unicorn/consistent-function-scoping
  function b () { return 1 + 2 } // eslint-disable-line unicorn/consistent-function-scoping

  t.false(compare(a, b).pass)
})

test('objects compare even if symbol properties are out of order', t => {
  const s1 = Symbol('s1')
  const s2 = Symbol('s2')
  const o1 = { [s1]: 1, [s2]: 2 }
  const o2 = { [s2]: 2, [s1]: 1 }

  t.true(compare(o1, o2).pass)

  const a1 = new Set([1, 2])
  a1[s1] = 1
  a1[s2] = 2
  const a2 = new Set([1, 2])
  a2[s2] = 2
  a2[s1] = 1

  t.true(compare(a1, a2).pass)
})

test('-0 is not equal to +0', t => {
  t.false(compare(-0, +0).pass)
  t.false(compare({ zero: -0 }, { zero: +0 }).pass)
})

test('NaN is equal to NaN', t => {
  t.true(compare(NaN, NaN).pass)
  t.true(compare({ notANumber: NaN }, { notANumber: NaN }).pass)
})

test('survives odd circular references', t => {
  const foo = { foo: {} }
  foo.foo.foo = foo
  const foo2 = {}
  foo2.foo = foo
  t.false(compare(foo, foo2).pass)
})

test('arrays are also compared by property', t => {
  const a1 = [1, 2, 3]
  a1.p = 'a1'
  const a2 = [1, 2, 3]
  a2.p = 'a2'
  t.false(compare(a1, a2).pass)

  const a3 = [1, 2, 3]
  const a4 = [1, 2, 3]
  a4[-1] = -1
  t.false(compare(a3, a4).pass)
})
