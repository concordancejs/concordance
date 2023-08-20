import { AMBIGUOUS, UNEQUAL } from '../constants.js'
import * as object from './object.js'

export function describe (props) {
	return new DescribedArgumentsValue(Object.assign({
		// Treat as an array, to allow comparisons with arrays
		isArray: true,
		isList: true,
	}, props, { ctor: 'Arguments' }))
}

export function deserialize (state, recursor) {
	return new DeserializedArgumentsValue(state, recursor)
}

export const tag = Symbol('ArgumentsValue')

class ArgumentsValue extends object.ObjectValue {
	compare (expected) {
		if (expected.isComplex !== true) return UNEQUAL

		// When used on the left-hand side of a comparison, argument values may be
		// compared to arrays.
		if (expected.stringTag === 'Array') return AMBIGUOUS

		return super.compare(expected)
	}

	tag = tag
}

const DescribedArgumentsValue = object.DescribedMixin(ArgumentsValue)

class DeserializedArgumentsValue extends object.DeserializedMixin(ArgumentsValue) {
	compare (expected) {
		// Deserialized argument values may only be compared to argument values.
		return expected.isComplex === true && expected.stringTag === 'Array'
			? UNEQUAL
			: super.compare(expected)
	}
}
