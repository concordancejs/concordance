import * as typedArray from './typedArray.js'

export function describe (props) {
  return new DescribedArrayBufferValue(Object.assign({
    buffer: Buffer.from(props.value),
    // Set isArray and isList so the property recursor excludes the byte accessors
    isArray: true,
    isList: true,
  }, props))
}

export function deserialize (state, recursor) {
  return new DeserializedArrayBufferValue(state, recursor)
}

export const tag = Symbol('ArrayBufferValue')

// ArrayBuffers can be represented as regular Buffers, allowing them to be
// treated as TypedArrays for the purposes of this package.
class ArrayBufferValue extends typedArray.TypedArrayValue {
  tag = tag
}

const DescribedArrayBufferValue = typedArray.DescribedMixin(ArrayBufferValue)
const DeserializedArrayBufferValue = typedArray.DeserializedMixin(ArrayBufferValue)
