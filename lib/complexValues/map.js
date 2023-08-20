import {SHALLOW_EQUAL, UNEQUAL} from '../constants.js'
import * as recursorUtils from '../recursorUtils.js'
import * as object from './object.js'

export function describe (props) {
	return new DescribedMapValue(Object.assign({
		size: props.value.size,
	}, props))
}

export function deserialize (state, recursor) {
	return new DeserializedMapValue(state, recursor)
}

export const tag = Symbol('MapValue')

class MapValue extends object.ObjectValue {
	constructor (props) {
		super(props)
		this.size = props.size
	}

	compare (expected) {
		const result = super.compare(expected)
		if (result !== SHALLOW_EQUAL) return result

		return this.size === expected.size
			? SHALLOW_EQUAL
			: UNEQUAL
	}

	prepareDiff (expected) {
		// Maps should be compared, even if they have a different number of entries.
		return { compareResult: super.compare(expected) }
	}

	serialize () {
		return [this.size, super.serialize()]
	}

	tag = tag
}

class DescribedMapValue extends object.DescribedMixin(MapValue) {
	createIterableRecursor () {
		const size = this.size
		if (size === 0) return recursorUtils.NOOP_RECURSOR

		let index = 0
		let entries
		const next = () => {
			if (index === size) return null

			if (!entries) {
				entries = Array.from(this.value)
			}

			const entry = entries[index++]
			return this.describeMapEntry(this.describeAny(entry[0]), this.describeAny(entry[1]))
		}

		return { size, next }
	}
}

class DeserializedMapValue extends object.DeserializedMixin(MapValue) {
	constructor (state, recursor) {
		super(state[1], recursor)
		this.size = state[0]
	}
}
