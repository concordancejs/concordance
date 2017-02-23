'use strict'

const hop = Object.prototype.hasOwnProperty
function hasLength (obj) {
  return hop.call(obj, 'length')
}
module.exports = hasLength
