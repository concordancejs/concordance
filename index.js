'use strict'

const compare = require('./lib/compare')
const describe = require('./lib/describe')
const diff = require('./lib/diff')
const format = require('./lib/format')

exports.compare = compare.compare
exports.compareDescriptors = compare.compareDescriptors

exports.describe = describe

exports.diff = diff.diff
exports.diffDescriptors = diff.diffDescriptors

exports.format = format.format
exports.formatDescriptor = format.formatDescriptor
