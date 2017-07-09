import test from 'ava'

import {serialization, tree} from './fixtures/pointerSerialization'
import {compareDescriptors, deserialize, describe} from '..'

test('pointer serialization equals the same tree', t => {
  t.true(compareDescriptors(deserialize(serialization), describe(tree)))
})
