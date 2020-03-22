'use strict'

const fs = require('fs')
const path = require('path')
const concordance = require('../..')

const foo = {}
const tree = {
  foo,
  bar: { foo },
}

const binFile = path.join(__dirname, path.basename(__filename, '.js') + '.bin')

if (require.main === module) {
  fs.writeFileSync(binFile, concordance.serialize(concordance.describe(tree)))
}

exports.tree = tree
exports.serialization = fs.readFileSync(binFile)
