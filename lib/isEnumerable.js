export default function isEnumerable(object, key) {
	const desc = Object.getOwnPropertyDescriptor(object, key);
	return desc && desc.enumerable;
}
