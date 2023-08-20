import { DEEP_EQUAL, UNEQUAL } from '../constants.js'
import * as formatUtils from '../formatUtils.js'
import lineBuilder from '../lineBuilder.js'

export function describe (value) {
	return new BigIntValue(value)
}

export const deserialize = describe

export const tag = Symbol('BigIntValue')

class BigIntValue {
	constructor (value) {
		this.value = value
	}

	compare (expected) {
		return expected.tag === tag && Object.is(this.value, expected.value)
			? DEEP_EQUAL
			: UNEQUAL
	}

	formatDeep (theme) {
		return lineBuilder.single(formatUtils.wrap(theme.bigInt, `${this.value}n`))
	}

	serialize () {
		return this.value
	}

	isPrimitive = true

	tag = tag
}
