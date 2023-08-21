import {tag as stringPrimitive} from '../primitiveValues/string.js';
import * as recursorUtils from '../recursorUtils.js';

import * as object from './object.js';

export function describe(props) {
	return new DescribedBoxedValue(props);
}

export function deserialize(state, recursor) {
	return new DeserializedBoxedValue(state, recursor);
}

export const tag = Symbol('BoxedValue');

class BoxedValue extends object.ObjectValue {
	tag = tag;
}

class DescribedBoxedValue extends object.DescribedMixin(BoxedValue) {
	constructor(props) {
		super(props);
		this.unboxed = props.unboxed;
	}

	createListRecursor() {
		return recursorUtils.NOOP_RECURSOR;
	}

	createPropertyRecursor() {
		if (this.unboxed.tag !== stringPrimitive) {
			return super.createPropertyRecursor();
		}

		// Just so that createPropertyRecursor() skips the index-based character
		// properties.
		try {
			this.isList = true;
			return super.createPropertyRecursor();
		} finally {
			this.isList = false;
		}
	}

	createRecursor() {
		return recursorUtils.unshift(super.createRecursor(), this.unboxed);
	}
}

const DeserializedBoxedValue = object.DeserializedMixin(BoxedValue);
