import never from 'never'

type ThemeRecord = {
  [key: string]: string | ThemeRecord
}

type Path<T extends string, K extends string> = `${T}${T extends '' ? '' : '.'}${K}`

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>
    }
  : T

// Base type for making properties readonly
type ReadonlyTheme<T> = T extends ThemeRecord ? { readonly [K in keyof T]: ReadonlyTheme<T[K]> } : T

// Collects only nested object paths (does not include the root level keys)
// This type recursively builds dot-notation paths for all nested objects
type NestedObjectPaths<T, Prefix extends string = ''> = T extends ThemeRecord
  ? {
      // Part 1: Create flat paths at the current level
      // Map through each key in the object, filtering to keep only those that lead to nested objects
      [K in keyof T as K extends string // Only process string keys
        ? Prefix extends ''
          ? never // Skip top-level keys (they're already accessible directly)
          : T[K] extends ThemeRecord
            ? Path<Prefix, K> // Create a dot-notation path like "object.bracket"
            : never // Skip leaf string values (we only want paths to objects)
        : never]: K extends string
        ? ReadonlyTheme<T[K]> // The value is the readonly version of the nested object
        : never
    } & (T extends ThemeRecord // Part 2: Recursively collect all nested paths from deeper levels
      ? UnionToIntersection<
          // Convert union of objects to a single object with all paths
          {
            // For each key in T that leads to a nested object...
            [K in keyof T]: K extends string
              ? T[K] extends ThemeRecord
                ? NestedObjectPaths<
                    // Recursively collect paths from the nested object
                    T[K], // The nested object
                    Path<Prefix, K> // The new prefix (e.g., "object.bracket")
                  >
                : never // Skip leaf values
              : never
          }[keyof T & string] // Index into the mapped type to get a union of all nested path objects
        >
      : {})
  : {}

// Final theme type that includes both the original structure and flattened paths
type NormalizedTheme<T> = ReadonlyTheme<T> & NestedObjectPaths<T>

export function normalizeTheme<T extends ThemeRecord>(root: T): NormalizedTheme<T> {
  // Queue of objects to process with their paths
  const queue: Array<{ record: ThemeRecord; path: string }> = [{ record: root, path: '' }]

  // Process all records in the queue
  while (queue.length > 0) {
    const { record, path } = queue.pop() ?? never()

    // Freeze the current record. Freeze root last
    if (record !== root) {
      Object.freeze(record)
    }

    // Process properties of the current record
    for (const [key, value] of Object.entries(record)) {
      if (value !== null && typeof value === 'object') {
        const extendedPath = path ? `${path}.${key}` : key

        // Add nested records to the queue
        queue.push({
          record: value,
          path: extendedPath,
        })

        // Only add non-top-level paths to the root
        if (path !== '') {
          Object.defineProperty(root, extendedPath, {
            enumerable: false,
            configurable: false,
            value,
          })
        }
      }
    }
  }

  return Object.freeze(root) as NormalizedTheme<T>
}

const defaultTheme = normalizeTheme({
  array: {
    bracket: { open: '[', close: ']' },
    sparse: '«empty item»',
  },
  aspect: { separator: '---' },
  bigInt: { open: '', close: '' },
  boolean: { open: '', close: '' },
  bytes: { open: '', close: '', empty: '«empty bytes»' },
  circular: '[Circular]',
  date: {
    open: '',
    close: '',
    invalid: 'invalid',
  },
  diffGutters: {
    delete: '- ',
    insert: '+ ',
    equal: '  ',
  },
  disambiguationHint: {
    open: '// ',
    close: '',
  },
  element: { after: ',' },
  external: '«external»',
  function: {
    constructorName: { open: '', close: '' },
    name: { open: '', close: '', empty: '«empty function name»' },
    stringTag: { open: '@', close: '', empty: '«empty string tag»' },
  },
  global: { open: '', close: '' },
  indent: '  ',
  iteratorValue: { after: ',' },
  mapEntry: { afterKey: ' => ', afterValue: ',' },
  maxDepth: '…',
  newline: '\n',
  null: { open: '', close: '' },
  number: { open: '', close: '' },
  object: {
    bracket: { open: '{', close: '}' },
    constructorName: { open: '', close: '', empty: '«empty constructor name»' },
    nullPrototype: '«null prototype»',
    stringTag: { open: '@', close: '', empty: '«empty string tag»' },
    secondaryStringTag: { open: '@', close: '', empty: '«empty string tag»' },
  },
  property: {
    afterKey: ': ',
    afterValue: ',',
    keyBracket: { open: '[', close: ']' },
  },
  regexp: {
    source: { open: '/', close: '/' },
    flags: { open: '', close: '' },
    separator: '---',
  },
  string: {
    open: '',
    close: '',
    line: { open: "'", close: "'", escapeQuote: "'" },
    multiline: { open: '`', close: '`', escapeQuote: '`' },
    controlPicture: { open: '', close: '' },
    diff: {
      insert: { open: '', close: '' },
      delete: { open: '', close: '' },
      equal: { open: '', close: '' },
      insertLine: { open: '', close: '' },
      deleteLine: { open: '', close: '' },
    },
  },
  symbol: { open: '', close: '' },
  undefined: { open: '', close: '' },
})

export type Theme = typeof defaultTheme

/**
 * Derives a theme object from user input, merging it with the default theme.
 * Any unknown properties are quietly discarded.
 *
 * @param input Optional partial theme object to merge with defaults
 * @returns A normalized and frozen theme object
 */
export function deriveTheme(input?: DeepPartial<Theme>): Theme {
  if (!input) {
    // Return the default theme directly since it's already normalized and frozen
    return defaultTheme
  }

  // We need to create a new object structure to avoid modifying the frozen defaultTheme
  const baseTheme = structuredClone(defaultTheme)

  // Apply the input theme to the base theme using an iterative approach
  // Create a queue of pairs [target, source] to merge
  const queue: Array<[ThemeRecord, ThemeRecord]> = [[baseTheme, input]]

  // Process all pairs in the queue
  while (queue.length > 0) {
    const [target, source] = queue.pop() ?? never()

    // Process all properties of the source
    for (const [key, sourceValue] of Object.entries(source)) {
      // Skip keys that don't exist in the target
      if (!(key in target)) continue

      const targetValue = target[key] // If both are objects, add them to the queue for deep merging
      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        typeof targetValue === 'object' &&
        targetValue !== null
      ) {
        queue.push([targetValue, sourceValue])
      } else if (typeof sourceValue === 'string') {
        // Only assign string values (according to ThemeRecord type)
        target[key] = sourceValue
      }
    }
  }

  // Normalize the merged theme
  return normalizeTheme(baseTheme)
}
