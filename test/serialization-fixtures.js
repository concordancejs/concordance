const test = require('ava')

const { compareDescriptors, deserialize, describe } = require('..')
const { serialization, tree } = require('./fixtures/pointerSerialization')

test('pointer serialization equals the same tree', t => {
  t.true(compareDescriptors(deserialize(serialization), describe(tree)))
})
