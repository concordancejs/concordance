import test from 'ava'

import compare from '../lib/compare'

test('compare functions by reference', t => {
  function a () { return 1 + 2 }
  const a_ = (() => {
    return function a () { return 1 + 2 } // eslint-disable-line no-shadow
  })()

  t.false(compare(a, a_))
})
