const { normalize } = require('../lib/themeUtils')

const unused = new Set()

const freeze = Object.freeze
const createAccessors = (object, path = '') => {
  for (const key of Object.keys(object)) {
    const value = object[key]
    const keyPath = path ? `${path}.${key}` : key
    if (value && typeof value === 'object') {
      createAccessors(value, keyPath)
    } else if (typeof value === 'string') {
      unused.add(keyPath)
      Object.defineProperty(object, key, {
        get () {
          unused.delete(keyPath)
          return `%${keyPath}${value ? '#' + value : ''}%`
        },
      })
    }
  }
  freeze.call(Object, object)
}

const theme = {} // normalize() caches the result, so this is just a cache key

Object.freeze = obj => obj // Stub out so accessors can be created
const normalized = normalize({ theme })
createAccessors(normalized)
Object.freeze = freeze

exports.theme = theme
exports.normalizedTheme = normalized
exports.checkThemeUsage = t => {
  t.deepEqual(unused, new Set(), 'All theme properties should be accessed at least once')
}
