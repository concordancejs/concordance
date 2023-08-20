import { DEEP_EQUAL, UNEQUAL } from '../constants.js'
import * as formatUtils from '../formatUtils.js'
import lineBuilder from '../lineBuilder.js'

export function describe () {
	return new NullValue()
}

export const deserialize = describe

export const tag = Symbol('NullValue')

class NullValue {
	compare (expected) {
		return expected.tag === tag
			? DEEP_EQUAL
			: UNEQUAL
	}

	formatDeep (theme) {
		return lineBuilder.single(formatUtils.wrap(theme.null, 'null'))
	}

	isPrimitive = true

	tag = tag
}
