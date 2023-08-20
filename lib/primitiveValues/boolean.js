import { DEEP_EQUAL, UNEQUAL } from '../constants.js'
import * as formatUtils from '../formatUtils.js'
import lineBuilder from '../lineBuilder.js'

export function describe (value) {
	return new BooleanValue(value)
}

export const deserialize = describe

export const tag = Symbol('BooleanValue')

class BooleanValue {
	constructor (value) {
		this.value = value
	}

	compare (expected) {
		return this.tag === expected.tag && this.value === expected.value
			? DEEP_EQUAL
			: UNEQUAL
	}

	formatDeep (theme) {
		return lineBuilder.single(formatUtils.wrap(theme.boolean, this.value === true ? 'true' : 'false'))
	}

	serialize () {
		return this.value
	}

	isPrimitive = true

	tag = tag
}
