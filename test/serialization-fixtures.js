import test from 'ava';

import {compareDescriptors, deserialize, describe} from '../index.js';

import {serialization, tree} from './fixtures/pointerSerialization.js';

test('pointer serialization equals the same tree', t => {
	t.true(compareDescriptors(deserialize(serialization), describe(tree)));
});
