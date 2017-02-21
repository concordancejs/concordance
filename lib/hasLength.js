'use strict'

const hop = Object.prototype.hasOwnProperty
module.exports = obj => hop.call(obj, 'length')
