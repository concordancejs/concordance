'use strict'

function formatCtorAndTag (complex) {
  if (!complex.ctor) return complex.tag

  let retval = complex.ctor
  if (complex.tag && complex.tag !== complex.ctor && complex.tag !== 'Object') {
    retval += ` @${complex.tag}`
  }
  return retval
}
exports.formatCtorAndTag = formatCtorAndTag
