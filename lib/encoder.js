'use strict'

const flattenDeep = require('lodash.flattendeep')

// Indexes are hexadecimal to make reading the binary output easier.
const valueTypes = {
  zero: 0x00,
  int8: 0x01,  // Note that the hex value equals the number of bytes required
  int16: 0x02, // to store the integer.
  int24: 0x03,
  int32: 0x04,
  int40: 0x05,
  int48: 0x06,
  // Leave room for int56 and int64
  numberString: 0x09,
  negativeZero: 0x0A,
  notANumber: 0x0B,
  infinity: 0x0C,
  negativeInfinity: 0x0D,
  undefined: 0x0E,
  null: 0x0F,
  true: 0x10,
  false: 0x11,
  utf8: 0x12,
  bytes: 0x13,
  list: 0x14,
  descriptor: 0x15
}

const descriptorSymbol = Symbol('descriptor')
exports.descriptorSymbol = descriptorSymbol

function encodeInteger (type, value) {
  const encoded = Buffer.alloc(type)
  encoded.writeIntLE(value, 0, type)
  return [type, encoded]
}

function encodeValue (value) {
  if (Object.is(value, 0)) return valueTypes.zero
  if (Object.is(value, -0)) return valueTypes.negativeZero
  if (Object.is(value, NaN)) return valueTypes.notANumber
  if (value === Infinity) return valueTypes.infinity
  if (value === -Infinity) return valueTypes.negativeInfinity
  if (value === undefined) return valueTypes.undefined
  if (value === null) return valueTypes.null
  if (value === true) return valueTypes.true
  if (value === false) return valueTypes.false

  const type = typeof value
  if (type === 'number') {
    if (Number.isInteger(value)) {
      // The integer types are signed, so int8 can only store 7 bits, int16
      // only 15, etc.
      if (value >= -0x80 && value < 0x80) return encodeInteger(valueTypes.int8, value)
      if (value >= -0x8000 && value < 0x8000) return encodeInteger(valueTypes.int16, value)
      if (value >= -0x800000 && value < 0x800000) return encodeInteger(valueTypes.int24, value)
      if (value >= -0x80000000 && value < 0x80000000) return encodeInteger(valueTypes.int32, value)
      if (value >= -0x8000000000 && value < 0x8000000000) return encodeInteger(valueTypes.int40, value)
      if (value >= -0x800000000000 && value < 0x800000000000) return encodeInteger(valueTypes.int48, value)
      // Fall through to encoding the value as a number string.
    }

    const encoded = Buffer.from(String(value), 'utf8')
    return [valueTypes.numberString, encodeValue(encoded.length), encoded]
  }

  if (type === 'string') {
    const encoded = Buffer.from(value, 'utf8')
    return [valueTypes.utf8, encodeValue(encoded.length), encoded]
  }

  if (Buffer.isBuffer(value)) {
    return [valueTypes.bytes, encodeValue(value.byteLength), value]
  }

  if (Array.isArray(value)) {
    return [
      value[descriptorSymbol] ? valueTypes.descriptor : valueTypes.list,
      encodeValue(value.length),
      value.map(encodeValue)
    ]
  }

  const hex = `0x${type.toString(16).toUpperCase()}`
  throw new TypeError(`Unexpected value with type ${hex}`)
}

function decodeValue (buffer, byteOffset) {
  const type = buffer.readUInt8(byteOffset)
  byteOffset += 1

  if (type === valueTypes.zero) return { byteOffset, value: 0 }
  if (type === valueTypes.negativeZero) return { byteOffset, value: -0 }
  if (type === valueTypes.notANumber) return { byteOffset, value: NaN }
  if (type === valueTypes.infinity) return { byteOffset, value: Infinity }
  if (type === valueTypes.negativeInfinity) return { byteOffset, value: -Infinity }
  if (type === valueTypes.undefined) return { byteOffset, value: undefined }
  if (type === valueTypes.null) return { byteOffset, value: null }
  if (type === valueTypes.true) return { byteOffset, value: true }
  if (type === valueTypes.false) return { byteOffset, value: false }

  if (
    type === valueTypes.int8 || type === valueTypes.int16 || type === valueTypes.int24 ||
    type === valueTypes.int32 || type === valueTypes.int40 || type === valueTypes.int48
  ) {
    const value = buffer.readIntLE(byteOffset, type)
    byteOffset += type
    return { byteOffset, value }
  }

  if (type === valueTypes.numberString || type === valueTypes.utf8 || type === valueTypes.bytes) {
    const length = decodeValue(buffer, byteOffset)
    const start = length.byteOffset
    const end = start + length.value

    if (type === valueTypes.numberString) {
      const value = Number(buffer.toString('utf8', start, end))
      return { byteOffset: end, value }
    }

    if (type === valueTypes.utf8) {
      const value = buffer.toString('utf8', start, end)
      return { byteOffset: end, value }
    }

    const value = buffer.slice(start, end)
    return { byteOffset: end, value }
  }

  if (type === valueTypes.list || type === valueTypes.descriptor) {
    const length = decodeValue(buffer, byteOffset)
    byteOffset = length.byteOffset

    const value = new Array(length.value)
    if (type === valueTypes.descriptor) {
      value[descriptorSymbol] = true
    }

    for (let index = 0; index < length.value; index++) {
      const item = decodeValue(buffer, byteOffset)
      byteOffset = item.byteOffset
      value[index] = item.value
    }

    return { byteOffset, value }
  }

  const hex = `0x${type.toString(16).toUpperCase()}`
  throw new TypeError(`Could not decode type ${hex}`)
}

function buildBuffer (numberOrArray) {
  if (typeof numberOrArray === 'number') {
    const byte = Buffer.alloc(1)
    byte.writeUInt8(numberOrArray)
    return byte
  }

  const array = flattenDeep(numberOrArray)
  const buffers = new Array(array.length)
  let byteLength = 0
  for (let index = 0; index < array.length; index++) {
    if (typeof array[index] === 'number') {
      byteLength += 1
      const byte = Buffer.alloc(1)
      byte.writeUInt8(array[index])
      buffers[index] = byte
    } else {
      byteLength += array[index].byteLength
      buffers[index] = array[index]
    }
  }
  return Buffer.concat(buffers, byteLength)
}

function encode (serializerVersion, rootRecord) {
  const buffers = []
  const pointers = []
  let byteOffset = 0

  const versionHeader = Buffer.alloc(2)
  versionHeader.writeUInt16LE(serializerVersion)
  buffers.push(versionHeader)
  byteOffset += versionHeader.byteLength

  const queue = [rootRecord]
  while (queue.length > 0) {
    if (pointers.length > 0) {
      pointers.shift().writeUInt32LE(byteOffset, 0)
    }

    const record = queue.shift()
    const recordHeader = buildBuffer([
      record.id,
      encodeValue(record.children.length)
    ])
    buffers.push(recordHeader)
    byteOffset += recordHeader.byteLength

    // Add pointers before encoding the state. This allows, if it ever becomes
    // necessary, for records to be extracted from a buffer without having to
    // parse the (variable length) state field.
    for (const child of record.children) {
      queue.push(child)

      const pointer = Buffer.alloc(4)
      pointers.push(pointer)
      buffers.push(pointer)
      byteOffset += 4
    }

    const state = buildBuffer(encodeValue(record.state))
    buffers.push(state)
    byteOffset += state.byteLength
  }

  return Buffer.concat(buffers, byteOffset)
}
exports.encode = encode

function decodeRecord (buffer, byteOffset) {
  const id = buffer.readUInt8(byteOffset)
  byteOffset += 1

  const numPointers = decodeValue(buffer, byteOffset)
  byteOffset = numPointers.byteOffset

  const pointerAddresses = new Array(numPointers.value)
  for (let index = 0; index < numPointers.value; index++) {
    pointerAddresses[index] = buffer.readUInt32LE(byteOffset)
    byteOffset += 4
  }

  const state = decodeValue(buffer, byteOffset).value
  return {
    id,
    state,
    pointerAddresses
  }
}
exports.decodeRecord = decodeRecord

function extractVersion (buffer) {
  return buffer.readUInt16LE(0)
}
exports.extractVersion = extractVersion

function decode (buffer) {
  return decodeRecord(buffer, 2)
}
exports.decode = decode
