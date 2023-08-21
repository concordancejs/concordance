import test from 'ava';

import {compare} from '../index.js';

test('ignores undescribed own properties', t => {
	const a = new Proxy({a: 1}, {
		getOwnPropertyDescriptor(_target, _prop) {},
	});
	t.true(compare(a, {}).pass);
});
