'use strict'

const hop = Object.prototype.hasOwnProperty
function hasLength (obj) {
  return (
    Array.isArray(obj) ||
    (hop.call(obj, 'length') &&
      typeof obj.length === 'number' &&
      (obj.length === 0 || '0' in obj))
  )
}
module.exports = hasLength
