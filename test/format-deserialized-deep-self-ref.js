const test = require('ava')

const { describe, deserialize, formatDescriptor, serialize } = require('..')

test('formats deserialized self references beyond maxDepth', t => {
  const value = {}
  const descriptor = describe({
    // The nesting property's name must be lexically less than the shallow
    // property's name, so that it comes first in the serialization and the
    // shallow property's value's serialization is a pointer to the nesting
    // property's contents
    a: {
      b: value,
    },
    c: value,
  })
  const serialized = serialize(descriptor)
  const deserialized = deserialize(serialized)

  let formatted

  t.notThrows(() => {
    formatted = formatDescriptor(deserialized, { maxDepth: 1 })
  })

  t.snapshot(formatted)
})
