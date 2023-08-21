import {isLength} from './lodash/index.js';

export default function hasLength(object) {
	return (
		Array.isArray(object)
		|| (Object.hasOwn(object, 'length')
			&& isLength(object.length)
			&& (object.length === 0 || '0' in object))
	);
}
