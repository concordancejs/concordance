const test = require('ava')

const getStringTagPath = require.resolve('../lib/getStringTag')

function requireWithPromiseStringTag (value, assertions) {
  const descriptor = Object.getOwnPropertyDescriptor(Promise.prototype, Symbol.toStringTag)

  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Promise.prototype, Symbol.toStringTag, {
    configurable: true,
    value,
  })
  delete require.cache[getStringTagPath]

  try {
    assertions(require('../lib/getStringTag'))
  } finally {
    if (descriptor) {
      // eslint-disable-next-line no-extend-native
      Object.defineProperty(Promise.prototype, Symbol.toStringTag, descriptor)
    } else {
      delete Promise.prototype[Symbol.toStringTag]
    }
    delete require.cache[getStringTagPath]
  }
}

test('detects promises when their native string tag is Object', t => {
  requireWithPromiseStringTag('Object', getStringTag => {
    t.is(Object.prototype.toString.call(Promise.resolve()), '[object Object]')
    t.is(getStringTag(Promise.resolve()), 'Promise')
  })
})

test('uses the native string tag when promises are reported correctly', t => {
  const getStringTag = require('../lib/getStringTag')
  t.is(getStringTag(Promise.resolve()), 'Promise')
})

test('does not mistake plain objects for promises in string tag workaround', t => {
  requireWithPromiseStringTag('Object', getStringTag => {
    t.is(getStringTag({}), 'Object')
    t.is(getStringTag(Object.create(null)), 'Object')
    t.is(getStringTag({ constructor: 42 }), 'Object')
  })
})
