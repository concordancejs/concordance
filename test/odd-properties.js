import test from 'ava'
import { compare } from '../index.js'

test('ignores undescribed own properties', t => {
	const a = new Proxy({ a: 1 }, {
		getOwnPropertyDescriptor (target, prop) {},
	})
	t.true(compare(a, {}).pass)
})
