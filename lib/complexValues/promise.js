import {DEEP_EQUAL, UNEQUAL} from '../constants.js';

import * as object from './object.js';

export function describe(props) {
	return new DescribedPromiseValue(props);
}

export function deserialize(props) {
	return new DeserializedPromiseValue(props);
}

export const tag = Symbol('PromiseValue');

class PromiseValue extends object.ObjectValue {
	tag = tag;
}

class DescribedPromiseValue extends object.DescribedMixin(PromiseValue) {
	compare(expected) {
		// When comparing described promises, require them to be the exact same
		// object.
		return super.compare(expected) === DEEP_EQUAL
			? DEEP_EQUAL
			: UNEQUAL;
	}
}

class DeserializedPromiseValue extends object.DeserializedMixin(PromiseValue) {
	compare(expected) {
		// Deserialized promises can never be compared using object references.
		return super.compare(expected);
	}
}
