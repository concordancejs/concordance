const test = require('ava')

const { describe, deserialize, diffDescriptors, formatDescriptor, serialize } = require('..')

// See <https://github.com/concordancejs/concordance/issues/66>.
test('greedy deserialization allows formatting pointers hidden behind maxDepth', t => {
  const value = {}
  const descriptor = describe({
    // `value` is encoded in the serialization of `a.b`. `c` is encoded as a
    // pointer to the encoded `value`.
    a: {
      b: value,
    },
    c: value,
  })
  const serialized = serialize(descriptor)

  t.throws(() => {
    // Without greedy deserialization, `maxDepth: 1` means that `a.b` will never be deserialized, and so the `c`
    // pointer cannot be resolved.
    formatDescriptor(deserialize(serialized), { maxDepth: 1 })
  }, { name: 'PointerLookupError' })

  t.throws(() => {
    // Without greedy deserialization, `maxDepth: 1` means that `a.b` will never be deserialized, and so the `c`
    // pointer cannot be resolved.
    diffDescriptors(deserialize(serialized), describe(undefined), { maxDepth: 1 })
  }, { name: 'PointerLookupError' })

  t.notThrows(() => {
    // Greedy deserialization causes `a.b` to be deserialized, so that the `c`
    // pointer can be resolved.
    const deserialized = deserialize(serialized, { greedy: true })
    formatDescriptor(deserialized, { maxDepth: 1 })
  })

  t.notThrows(() => {
    // Greedy deserialization causes `a.b` to be deserialized, so that the `c`
    // pointer can be resolved.
    const deserialized = deserialize(serialized, { greedy: true })
    diffDescriptors(deserialized, describe(undefined), { maxDepth: 1 })
  })
})

test('primitive', t => {
  const descriptor = describe(t.title)
  const serialized = serialize(descriptor)
  t.notThrows(() => {
    deserialize(serialized, { greedy: true })
  })
})
