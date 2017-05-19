import {serial as test} from 'ava'
import mock from 'mock-require'
import proxyquire from 'proxyquire'

const stub = {
  isSubsetOf (otherFlags) {
    return (this.bitFlags & otherFlags) === this.bitFlags
  },
  isSupersetOf (otherFlags) {
    return (this.bitFlags & otherFlags) === otherFlags
  }
}
test.beforeEach(() => {
  Object.assign(stub, {
    support: {},
    hasFullSupport: false,
    bitFlags: 0b101
  })
})

mock('../lib/complexValues/function', proxyquire('../lib/complexValues/function', {
  'function-name-support': stub
}))

const {compareDescriptors, describe, deserialize, serialize} = require('..')

const prepareLhs = fn => deserialize(serialize(describe(fn)))

function foo () {}
function bar () {}

test('same flags, full support, different names', t => {
  stub.hasFullSupport = true
  t.false(compareDescriptors(prepareLhs(foo), describe(bar)))
})

test('same flags, not full support, lhs has no name', t => {
  t.true(compareDescriptors(prepareLhs(() => {}), describe(bar)))
})

test('same flags, not full support, rhs has no name', t => {
  t.true(compareDescriptors(prepareLhs(foo), describe(() => {})))
})

test('subset, different names', t => {
  const lhs = prepareLhs(foo)
  stub.bitFlags = 0b001
  t.false(compareDescriptors(lhs, describe(bar)))
})

test('subset, lhs has no name', t => {
  const lhs = prepareLhs(() => {})
  stub.bitFlags = 0b001
  t.false(compareDescriptors(lhs, describe(bar)))
})

test('subset, rhs has no name', t => {
  const lhs = prepareLhs(foo)
  stub.bitFlags = 0b001
  t.true(compareDescriptors(lhs, describe(() => {})))
})

test('superset, different names', t => {
  const lhs = prepareLhs(foo)
  stub.bitFlags = 0b111
  t.false(compareDescriptors(lhs, describe(bar)))
})

test('superset, lhs has no name', t => {
  const lhs = prepareLhs(() => {})
  stub.bitFlags = 0b111
  t.true(compareDescriptors(lhs, describe(bar)))
})

test('superset, rhs has no name', t => {
  const lhs = prepareLhs(foo)
  stub.bitFlags = 0b111
  t.false(compareDescriptors(lhs, describe(() => {})))
})
