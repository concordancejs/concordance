import {serial as test} from 'ava'

// Ensure module is in the require cache.
require('function-name-support')

const stub = {
  isSubsetOf (otherFlags) {
    return (this.bitFlags & otherFlags) === this.bitFlags
  },
  isSupersetOf (otherFlags) {
    return (this.bitFlags & otherFlags) === otherFlags
  }
}
// Patch the module.
require.cache[require.resolve('function-name-support')].exports = stub

test.beforeEach(() => {
  Object.assign(stub, {
    support: {},
    hasFullSupport: false,
    bitFlags: 0b101
  })
})

const {compareDescriptors, describe, deserialize, serialize} = require('..')

const prepareLhs = fn => deserialize(serialize(describe(fn)))

function foo () {}
function bar () {}
class Foo {}
class Bar {}

test('same flags, full support, different names', t => {
  stub.hasFullSupport = true
  t.false(compareDescriptors(prepareLhs(foo), describe(bar)))
  t.false(compareDescriptors(prepareLhs(new Foo()), describe(new Bar())))
})

test('same flags, not full support, lhs has no name', t => {
  t.true(compareDescriptors(prepareLhs(() => {}), describe(bar)))
  t.true(compareDescriptors(prepareLhs(new (class {})()), describe(new Bar())))
})

test('same flags, not full support, rhs has no name', t => {
  t.true(compareDescriptors(prepareLhs(foo), describe(() => {})))
  t.true(compareDescriptors(prepareLhs(new Foo()), describe(new (class {})())))
})

test('subset, different names', t => {
  const lhsFn = prepareLhs(foo)
  const lhsObj = prepareLhs(new Foo())
  stub.bitFlags = 0b001
  t.false(compareDescriptors(lhsFn, describe(bar)))
  t.false(compareDescriptors(lhsObj, describe(new Bar())))
})

test('subset, lhs has no name', t => {
  const lhsFn = prepareLhs(() => {})
  const lhsObj = prepareLhs(new (class {})())
  stub.bitFlags = 0b001
  t.false(compareDescriptors(lhsFn, describe(bar)))
  t.false(compareDescriptors(lhsObj, describe(new Bar())))
})

test('subset, rhs has no name', t => {
  const lhsFn = prepareLhs(foo)
  const lhsObj = prepareLhs(new Foo())
  stub.bitFlags = 0b001
  t.true(compareDescriptors(lhsFn, describe(() => {})))
  t.true(compareDescriptors(lhsObj, describe(new (class {})())))
})

test('superset, different names', t => {
  const lhsFn = prepareLhs(foo)
  const lhsObj = prepareLhs(new Foo())
  stub.bitFlags = 0b111
  t.false(compareDescriptors(lhsFn, describe(bar)))
  t.false(compareDescriptors(lhsObj, describe(new Bar())))
})

test('superset, lhs has no name', t => {
  const lhsFn = prepareLhs(() => {})
  const lhsObj = prepareLhs(new (class {})())
  stub.bitFlags = 0b111
  t.true(compareDescriptors(lhsFn, describe(bar)))
  t.true(compareDescriptors(lhsObj, describe(new Bar())))
})

test('superset, rhs has no name', t => {
  const lhsFn = prepareLhs(foo)
  const lhsObj = prepareLhs(new Foo())
  stub.bitFlags = 0b111
  t.false(compareDescriptors(lhsFn, describe(() => {})))
  t.false(compareDescriptors(lhsObj, describe(new (class {})())))
})
