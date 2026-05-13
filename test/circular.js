const test = require('ava')

const Circular = require('../lib/Circular')

test('tracks descriptors in insertion order', t => {
  const stack = new Circular()
  const first = { label: 'first' }
  const second = { label: 'second' }

  stack.add(first).add(second)

  t.true(stack.has(first))
  t.true(stack.has(second))
  t.is(stack.get(first), 1)
  t.is(stack.get(second), 2)
})

test('does not track item, map-entry and property descriptors', t => {
  const stack = new Circular()
  const item = { isItem: true }
  const mapEntry = { isMapEntry: true }
  const property = { isProperty: true }

  stack.add(item).add(mapEntry).add(property)

  t.false(stack.has(item))
  t.false(stack.has(mapEntry))
  t.false(stack.has(property))
  t.is(stack.get(item), 0)
  t.is(stack.get(mapEntry), 0)
  t.is(stack.get(property), 0)
})

test('throws if descriptor is added twice', t => {
  const stack = new Circular()
  const descriptor = { label: 'duplicate' }

  stack.add(descriptor)

  const error = t.throws(() => stack.add(descriptor))
  t.is(error.message, 'Already in stack')
})

test('throws if deleting descriptor that is not on top of stack', t => {
  const stack = new Circular()
  const first = { label: 'first' }
  const second = { label: 'second' }

  stack.add(first).add(second)

  const error = t.throws(() => stack.delete(first))
  t.is(error.message, 'Not on top of stack')
})

