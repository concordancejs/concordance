const test = require('ava')

const Circular = require('../lib/Circular')
const constants = require('../lib/constants')
const pointer = require('../lib/metaDescriptors/pointer')
const stats = require('../lib/metaDescriptors/stats')
const recursorUtils = require('../lib/recursorUtils')

test('recursorUtils.sequence emits from the second recursor once the first is exhausted', t => {
  const firstValues = ['first', null]
  const secondValues = ['second', null]
  const recursor = recursorUtils.sequence(
    () => firstValues.shift(),
    () => secondValues.shift())

  t.is(recursor(), 'first')
  t.is(recursor(), 'second')
  t.is(recursor(), null)
})

test('recursorUtils.replay shares buffered values between recursors', t => {
  const values = ['first', 'second', null]
  const create = () => ({
    size: 2,
    next () {
      return values.shift()
    },
  })

  const first = recursorUtils.replay(null, create)
  const state = first.state
  t.is(first.recursor.next(), 'first')

  const second = recursorUtils.replay(state, create)
  t.is(second.state, state)
  t.is(second.recursor.next(), 'first')
  t.is(second.recursor.next(), 'second')
  t.is(first.recursor.next(), 'second')
  t.is(first.recursor.next(), null)
  t.is(second.recursor.next(), null)
})

test('recursorUtils.replay preserves the noop recursor', t => {
  const replayed = recursorUtils.replay(null, () => recursorUtils.NOOP_RECURSOR)

  t.is(replayed.state, recursorUtils.NOOP_RECURSOR)
  t.is(replayed.recursor, recursorUtils.NOOP_RECURSOR)
  t.is(replayed.recursor.next(), null)
})

test('Circular rejects duplicate additions and non-top deletions', t => {
  const circular = new Circular()
  const first = {}
  const second = {}

  circular.add(first).add(second)

  t.throws(() => circular.add(second), { message: 'Already in stack' })
  t.throws(() => circular.delete(first), { message: 'Not on top of stack' })

  t.true(circular.has(second))
  t.is(circular.get(second), 2)
})

test('Circular ignores structural descriptor wrappers', t => {
  const circular = new Circular()
  const item = { isItem: true }
  const mapEntry = { isMapEntry: true }
  const property = { isProperty: true }

  circular.add(item).add(mapEntry).add(property)

  t.false(circular.has(item))
  t.false(circular.has(mapEntry))
  t.false(circular.has(property))
  t.is(circular.get(item), 0)
})

test('pointer descriptors serialize but never compare as equal', t => {
  const descriptor = pointer.describe(3)
  const deserialized = pointer.deserialize(4)

  t.true(descriptor.isPointer)
  t.is(descriptor.tag, pointer.tag)
  t.is(descriptor.serialize(), 3)
  t.is(deserialized.index, 4)
  t.is(descriptor.compare(descriptor), constants.UNEQUAL)
})

test('stats descriptors return null when diff alignment cannot improve', t => {
  const actual = stats.describeIterableRecursor({ size: 1 })
  const expected = stats.describeListRecursor({ size: 1 })

  t.is(actual.prepareDiff(expected, () => null, () => null), null)
})
