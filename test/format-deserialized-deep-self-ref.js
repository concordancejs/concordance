const test = require('ava')

const concordance = require('..')

test('formats deserialized self references beyond maxDepth', t => {
  const value = {}
  const actualDescriptor = concordance.describe({
    // The nested property's name must be lexically less than the shallow
    // property's name, so that it's first in the serialization and the shallow
    // property's value's serialization is a pointer to the nested property's
    // contents
    a: {
      b: value,
    },
    c: value,
  })
  const serializedActual = concordance.serialize(actualDescriptor)
  const deserializedActual = concordance.deserialize(serializedActual)

  t.notThrows(() => {
    concordance.formatDescriptor(deserializedActual, { maxDepth: 1 })
  })
})
