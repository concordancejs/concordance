'use strict'

const encoder = require('./encoder')

const argumentsValue = require('./complexValues/arguments')
const arrayBufferValue = require('./complexValues/arrayBuffer')
const dataViewValue = require('./complexValues/dataView')
const dateValue = require('./complexValues/date')
const errorValue = require('./complexValues/error')
const functionValue = require('./complexValues/function')
const globalValue = require('./complexValues/global')
const mapValue = require('./complexValues/map')
const objectValue = require('./complexValues/object')
const promiseValue = require('./complexValues/promise')
const regexpValue = require('./complexValues/regexp')
const setValue = require('./complexValues/set')
const typedArrayValue = require('./complexValues/typedArray')

const itemDescriptor = require('./metaDescriptors/item')
const mapEntryDescriptor = require('./metaDescriptors/mapEntry')
const pointerDescriptor = require('./metaDescriptors/pointer')
const propertyDescriptor = require('./metaDescriptors/property')
const statsDescriptors = require('./metaDescriptors/stats')

const booleanValue = require('./primitiveValues/boolean')
const nullValue = require('./primitiveValues/null')
const numberValue = require('./primitiveValues/number')
const stringValue = require('./primitiveValues/string')
const symbolValue = require('./primitiveValues/symbol')
const undefinedValue = require('./primitiveValues/undefined')

// Adding or removing mappings or changing an index requires the version in
// encoder.js to be bumped, which necessitates a major version bump of kathryn
// itself. Indexes are hexadecimal to make reading the binary output easier.
const mappings = [
  [0x01, booleanValue.tag, booleanValue.deserialize],
  [0x02, nullValue.tag, nullValue.deserialize],
  [0x03, numberValue.tag, numberValue.deserialize],
  [0x04, stringValue.tag, stringValue.deserialize],
  [0x05, symbolValue.tag, symbolValue.deserialize],
  [0x06, undefinedValue.tag, undefinedValue.deserialize],

  [0x07, objectValue.tag, objectValue.deserialize],
  [0x08, statsDescriptors.iterableTag, statsDescriptors.deserializeIterableStats],
  [0x09, statsDescriptors.listTag, statsDescriptors.deserializeListStats],
  [0x0A, itemDescriptor.complexTag, itemDescriptor.deserializeComplex],
  [0x0B, itemDescriptor.primitiveTag, itemDescriptor.deserializePrimitive],
  [0x0C, statsDescriptors.propertyTag, statsDescriptors.deserializePropertyStats],
  [0x0D, propertyDescriptor.complexTag, propertyDescriptor.deserializeComplex],
  [0x0E, propertyDescriptor.primitiveTag, propertyDescriptor.deserializePrimitive],
  [0x0F, pointerDescriptor.tag, pointerDescriptor.deserialize],

  [0x10, mapValue.tag, mapValue.deserialize],
  [0x11, mapEntryDescriptor.tag, mapEntryDescriptor.deserialize],

  [0x12, argumentsValue.tag, argumentsValue.deserialize],
  [0x13, arrayBufferValue.tag, arrayBufferValue.deserialize],
  [0x14, dataViewValue.tag, dataViewValue.deserialize],
  [0x15, dateValue.tag, dateValue.deserialize],
  [0x16, errorValue.tag, errorValue.deserialize],
  [0x17, functionValue.tag, functionValue.deserialize],
  [0x18, globalValue.tag, globalValue.deserialize],
  [0x19, promiseValue.tag, promiseValue.deserialize],
  [0x1A, regexpValue.tag, regexpValue.deserialize],
  [0x1B, setValue.tag, setValue.deserialize],
  [0x1C, typedArrayValue.tag, typedArrayValue.deserialize],
  [0x1D, typedArrayValue.bytesTag, typedArrayValue.deserializeBytes]
]
const tag2id = new Map(mappings.map(mapping => [mapping[1], mapping[0]]))
const id2deserialize = new Map(mappings.map(mapping => [mapping[0], mapping[2]]))

function shallowSerializeDescriptor (descriptor) {
  if (!descriptor.serialize) return undefined

  return serializeState(descriptor.serialize())
}

function serializeState (state) {
  if (Array.isArray(state)) return state.map(serializeState)

  if (state && tag2id.has(state.tag)) {
    const descriptor = state
    const serialized = [tag2id.get(descriptor.tag), shallowSerializeDescriptor(descriptor)]
    serialized[encoder.descriptorSymbol] = true
    return serialized
  }

  return state
}

function serialize (descriptor) {
  const stack = []
  let topIndex = -1

  let rootRecord
  do {
    const record = {
      id: tag2id.get(descriptor.tag),
      children: [],
      state: shallowSerializeDescriptor(descriptor)
    }
    if (!rootRecord) {
      rootRecord = record
    } else {
      stack[topIndex].children.push(record)
    }

    if (descriptor.createRecursor) {
      stack.push({ recursor: descriptor.createRecursor(), children: record.children })
      topIndex++
    }

    while (topIndex >= 0) {
      descriptor = stack[topIndex].recursor()
      if (descriptor === null) {
        stack.pop()
        topIndex--
      } else {
        break
      }
    }
  } while (topIndex >= 0)

  return encoder.encode(rootRecord)
}
exports.serialize = serialize

function deserializeState (state) {
  if (state && state[encoder.descriptorSymbol] === true) {
    return shallowDeserializeDescriptor(state)
  }

  return Array.isArray(state)
    ? state.map(deserializeState)
    : state
}

function shallowDeserializeDescriptor (entry) {
  const deserialize = id2deserialize.get(entry[0])
  return deserialize(entry[1])
}

function deserializeRecord (record, buffer) {
  const deserializeDescriptor = id2deserialize.get(record.id)
  const state = deserializeState(record.state)

  if (record.pointerAddresses.length === 0) {
    return deserializeDescriptor(state)
  }

  const endIndex = record.pointerAddresses.length
  let index = 0
  const recursor = () => {
    if (index === endIndex) return null

    const recursorRecord = encoder.decodeRecord(buffer, record.pointerAddresses[index++])
    return deserializeRecord(recursorRecord, buffer)
  }

  return deserializeDescriptor(state, recursor)
}

function deserialize (buffer) {
  const rootRecord = encoder.decode(buffer)
  return deserializeRecord(rootRecord, buffer)
}
exports.deserialize = deserialize
