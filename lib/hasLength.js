import {isLength} from './lodash/index.js'

export default function hasLength (obj) {
  return (
    Array.isArray(obj) ||
    (Object.hasOwn(obj, 'length') &&
      isLength(obj.length) &&
      (obj.length === 0 || '0' in obj))
  )
}
