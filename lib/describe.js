import Registry from './Registry.js'
import * as argumentsValue from './complexValues/arguments.js'
import * as arrayBufferValue from './complexValues/arrayBuffer.js'
import * as boxedValue from './complexValues/boxed.js'
import * as dataViewValue from './complexValues/dataView.js'
import * as dateValue from './complexValues/date.js'
import * as errorValue from './complexValues/error.js'
import * as functionValue from './complexValues/function.js'
import * as globalValue from './complexValues/global.js'
import * as mapValue from './complexValues/map.js'
import * as objectValue from './complexValues/object.js'
import * as promiseValue from './complexValues/promise.js'
import * as regexpValue from './complexValues/regexp.js'
import * as setValue from './complexValues/set.js'
import * as typedArrayValue from './complexValues/typedArray.js'

import getCtor from './getCtor.js'
import getStringTag from './getStringTag.js'
import * as itemDescriptor from './metaDescriptors/item.js'
import * as mapEntryDescriptor from './metaDescriptors/mapEntry.js'
import * as propertyDescriptor from './metaDescriptors/property.js'

import * as pluginRegistry from './pluginRegistry.js'
import * as bigIntValue from './primitiveValues/bigInt.js'
import * as booleanValue from './primitiveValues/boolean.js'
import * as nullValue from './primitiveValues/null.js'
import * as numberValue from './primitiveValues/number.js'
import * as stringValue from './primitiveValues/string.js'
import * as symbolValue from './primitiveValues/symbol.js'
import * as undefinedValue from './primitiveValues/undefined.js'

const SpecializedComplexes = new Map([
  ['Arguments', argumentsValue.describe],
  ['ArrayBuffer', arrayBufferValue.describe],
  ['DataView', dataViewValue.describe],
  ['Date', dateValue.describe],
  ['Error', errorValue.describe],
  ['Float32Array', typedArrayValue.describe],
  ['Float64Array', typedArrayValue.describe],
  ['Function', functionValue.describe],
  ['GeneratorFunction', functionValue.describe],
  ['global', globalValue.describe],
  ['Int16Array', typedArrayValue.describe],
  ['Int32Array', typedArrayValue.describe],
  ['Int8Array', typedArrayValue.describe],
  ['Map', mapValue.describe],
  ['Promise', promiseValue.describe],
  ['RegExp', regexpValue.describe],
  ['Set', setValue.describe],
  ['Uint16Array', typedArrayValue.describe],
  ['Uint32Array', typedArrayValue.describe],
  ['Uint8Array', typedArrayValue.describe],
  ['Uint8ClampedArray', typedArrayValue.describe],
])

function describePrimitive (value) {
  if (value === null) return nullValue.describe()
  if (value === undefined) return undefinedValue.describe()
  if (value === true || value === false) return booleanValue.describe(value)

  const type = typeof value
  if (type === 'bigint') return bigIntValue.describe(value)
  if (type === 'number') return numberValue.describe(value)
  if (type === 'string') return stringValue.describe(value)
  if (type === 'symbol') return symbolValue.describe(value)

  return null
}

function unboxComplex (tag, complex) {
  // Try to unbox by calling `valueOf()`. `describePrimitive()` will return
  // `null` if the resulting value is not a primitive, in which case it's
  // ignored.
  if (typeof complex.valueOf === 'function') {
    const value = complex.valueOf()
    if (value !== complex) return describePrimitive(value)
  }

  return null
}

function registerPlugins (plugins) {
  if (!Array.isArray(plugins) || plugins.length === 0) return () => null

  const tryFns = pluginRegistry.getTryDescribeValues(plugins)
  return (value, stringTag, ctor) => {
    for (const tryDescribeValue of tryFns) {
      const describeValue = tryDescribeValue(value, stringTag, ctor)
      if (describeValue) return describeValue
    }

    return null
  }
}

function describeComplex (value, registry, tryPlugins, describeAny, describeItem, describeMapEntry, describeProperty) {
  if (registry.has(value)) return registry.get(value)

  const stringTag = getStringTag(value)
  const ctor = getCtor(stringTag, value)
  const pointer = registry.alloc(value)

  let unboxed
  let describeValue = tryPlugins(value, stringTag, ctor)
  if (describeValue === null) {
    if (SpecializedComplexes.has(stringTag)) {
      describeValue = SpecializedComplexes.get(stringTag)
    } else {
      unboxed = unboxComplex(stringTag, value)
      if (unboxed !== null) {
        describeValue = boxedValue.describe
      } else {
        describeValue = objectValue.describe
      }
    }
  }

  const descriptor = describeValue({
    ctor,
    describeAny,
    describeItem,
    describeMapEntry,
    describeProperty,
    pointer: pointer.index,
    stringTag,
    unboxed,
    value,
  })
  pointer.descriptor = descriptor
  return descriptor
}

const describeItem = (index, valueDescriptor) => {
  return valueDescriptor.isPrimitive === true
    ? itemDescriptor.describePrimitive(index, valueDescriptor)
    : itemDescriptor.describeComplex(index, valueDescriptor)
}

const describeMapEntry = (keyDescriptor, valueDescriptor) => {
  return mapEntryDescriptor.describe(keyDescriptor, valueDescriptor)
}

export default function describe (value, options) {
  const primitive = describePrimitive(value)
  if (primitive !== null) return primitive

  const registry = new Registry()
  const tryPlugins = registerPlugins(options && options.plugins)
  const curriedComplex = c => {
    return describeComplex(c, registry, tryPlugins, describeAny, describeItem, describeMapEntry, describeProperty)
  }

  const describeAny = any => {
    const descriptor = describePrimitive(any)
    return descriptor !== null
      ? descriptor
      : curriedComplex(any)
  }

  const describeProperty = (key, valueDescriptor) => {
    const keyDescriptor = describePrimitive(key)
    return valueDescriptor.isPrimitive === true
      ? propertyDescriptor.describePrimitive(keyDescriptor, valueDescriptor)
      : propertyDescriptor.describeComplex(keyDescriptor, valueDescriptor)
  }

  return curriedComplex(value)
}
