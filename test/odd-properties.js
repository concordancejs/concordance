const test = require('ava')
const { compare } = require('..')

test('ignores undescribed own properties', t => {
  const a = new Proxy({ a: 1 }, {
    getOwnPropertyDescriptor (target, prop) {},
  })
  t.true(compare(a, {}).pass)
})
