import {tag as argumentsObject} from './complexValues/arguments.js';
import {AMBIGUOUS, SHALLOW_EQUAL} from './constants.js';

export default function shouldCompareDeep(result, lhs, _rhs) {
	if (result === SHALLOW_EQUAL) {
		return true;
	}

	if (result !== AMBIGUOUS) {
		return false;
	}

	// Properties are only ambiguous if they have symbol keys. These properties
	// must be compared in an order-insensitive manner.
	return lhs.tag === argumentsObject || lhs.isProperty === true;
}
