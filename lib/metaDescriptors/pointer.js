import {UNEQUAL} from '../constants.js';

export function describe(index) {
	return new Pointer(index);
}

export const deserialize = describe;

export const tag = Symbol('Pointer');

class Pointer {
	constructor(index) {
		this.index = index;
	}

	// Pointers cannot be compared, and are not expected to be part of the
	// comparisons.
	compare(_expected) {
		return UNEQUAL;
	}

	serialize() {
		return this.index;
	}

	isPrimitive = true;

	tag = tag;
}
