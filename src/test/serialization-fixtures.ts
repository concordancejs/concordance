import test from 'ava'
import { readFile } from 'fs/promises'

import { compareDescriptors, deserialize, describe } from '../exports.ts'
import { tree, binFile } from './fixtures/pointer-serialization.ts'

const serialization = await readFile(binFile)
test('pointer serialization equals the same tree', (t) => {
  deserialize(serialization)
  t.true(compareDescriptors(deserialize(serialization), describe(tree)))
})
