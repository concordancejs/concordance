import {SHALLOW_EQUAL, UNEQUAL} from '../constants.js';
import * as recursorUtils from '../recursorUtils.js';

import * as object from './object.js';

export function describe(props) {
	return new DescribedSetValue({size: props.value.size, ...props});
}

export function deserialize(state, recursor) {
	return new DeserializedSetValue(state, recursor);
}

export const tag = Symbol('SetValue');

class SetValue extends object.ObjectValue {
	constructor(props) {
		super(props);
		this.size = props.size;
	}

	compare(expected) {
		const result = super.compare(expected);
		if (result !== SHALLOW_EQUAL) {
			return result;
		}

		return this.size === expected.size
			? SHALLOW_EQUAL
			: UNEQUAL;
	}

	prepareDiff(expected) {
		// Sets should be compared, even if they have a different number of items.
		return {compareResult: super.compare(expected)};
	}

	serialize() {
		return [this.size, super.serialize()];
	}

	tag = tag;
}

class DescribedSetValue extends object.DescribedMixin(SetValue) {
	createIterableRecursor() {
		const {size} = this;
		if (size === 0) {
			return recursorUtils.NOOP_RECURSOR;
		}

		let index = 0;
		let members;
		const next = () => {
			if (index === size) {
				return null;
			}

			if (!members) {
				members = [...this.value];
			}

			const value = members[index];
			return this.describeItem(index++, this.describeAny(value));
		};

		return {size, next};
	}
}

class DeserializedSetValue extends object.DeserializedMixin(SetValue) {
	constructor(state, recursor) {
		super(state[1], recursor);
		this.size = state[0];
	}
}
