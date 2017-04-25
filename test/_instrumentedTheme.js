import {normalize} from '../lib/themeUtils'

const unused = new Set()
const createAccessors = (object, path = '') => {
  for (const key of Object.keys(object)) {
    const value = object[key]
    const keyPath = path ? `${path}.${key}` : key
    if (typeof value === 'object') {
      createAccessors(value, keyPath)
    } else {
      unused.add(keyPath)
      Object.defineProperty(object, key, {
        get () {
          unused.delete(keyPath)
          return `%${keyPath}${value ? '#' + value : ''}%`
        }
      })
    }
  }
}

const theme = {} // normalize() caches the result, so this is just a cache key
const normalized = normalize(theme)
createAccessors(normalized)

export default theme
export {normalized as normalizedTheme}
export function checkThemeUsage (t) {
  t.deepEqual(unused, new Set(), 'All theme properties should be accessed at least once')
}
