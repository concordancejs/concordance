const test = require('ava')

const {serialization, tree} = require('./fixtures/pointerSerialization')
const {compareDescriptors, deserialize, describe} = require('..')

test('pointer serialization equals the same tree', t => {
  t.true(compareDescriptors(deserialize(serialization), describe(tree)))
})
