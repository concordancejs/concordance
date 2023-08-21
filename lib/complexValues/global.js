import {DEEP_EQUAL, UNEQUAL} from '../constants.js';
import * as formatUtils from '../formatUtils.js';
import lineBuilder from '../lineBuilder.js';

export function describe() {
	return new GlobalValue();
}

export const deserialize = describe;

export const tag = Symbol('GlobalValue');

class GlobalValue {
	compare(expected) {
		return this.tag === expected.tag
			? DEEP_EQUAL
			: UNEQUAL;
	}

	formatDeep(theme) {
		return lineBuilder.single(
			formatUtils.wrap(theme.global, 'Global') + ' ' + theme.object.openBracket + theme.object.closeBracket,
		);
	}

	isComplex = true;

	tag = tag;
}
