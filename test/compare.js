import test from 'ava'

import compare from '../lib/compare'

test('compare functions by reference', t => {
  function a () { return 1 + 2 }
  const a_ = (() => {
    return function a () { return 1 + 2 } // eslint-disable-line no-shadow
  })()

  t.false(compare(a, a_))
})

test('objects compare even if symbol properties are out of order', t => {
  const s1 = Symbol('s1')
  const s2 = Symbol('s2')
  const o1 = { [s1]: 1, [s2]: 2 }
  const o2 = { [s2]: 2, [s1]: 1 }

  t.true(compare(o1, o2))

  const a1 = new Set([1, 2])
  a1[s1] = 1
  a1[s2] = 2
  const a2 = new Set([1, 2])
  a2[s2] = 2
  a2[s1] = 1

  t.true(compare(a1, a2))

  const a3 = new Set([3, 0])
  a1[s1] = 1
  a1[s2] = 2
  const a4 = new Set([4, 0])
  a2[s2] = 2
  a2[s1] = 1

  t.false(compare(a3, a4))
})
