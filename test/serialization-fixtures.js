import test from 'ava';

import {compareDescriptors, deserialize, describe, diff} from '../index.js';

import {serialization, tree} from './fixtures/pointerSerialization.js';

test('pointer serialization equals the same tree', t => {
	t.log(diff(deserialize(serialization), describe(tree)));
	t.true(compareDescriptors(deserialize(serialization), describe(tree)));
});
