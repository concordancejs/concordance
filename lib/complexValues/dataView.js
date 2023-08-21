import * as typedArray from './typedArray.js';

export function describe(props) {
	return new DescribedDataViewValue({
		buffer: typedArray.getBuffer(props.value),
		// Set isArray and isList so the property recursor excludes the byte accessors
		isArray: true,
		isList: true,
		...props,
	});
}

export function deserialize(state, recursor) {
	return new DeserializedDataViewValue(state, recursor);
}

export const tag = Symbol('DataViewValue');

// DataViews can be represented as regular Buffers, allowing them to be treated
// as TypedArrays for the purposes of this package.
class DataViewValue extends typedArray.TypedArrayValue {
	tag = tag;
}

const DescribedDataViewValue = typedArray.DescribedMixin(DataViewValue);
const DeserializedDataViewValue = typedArray.DeserializedMixin(DataViewValue);
