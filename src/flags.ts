// Define the flags and their default values. Whether new flags, or changes to existing flags, are breaking changes is
// decided on a case-by-case basis. Consumers of this library should use `deriveFlags()` to better control defaults
// across releases.
const flags = {
  compareArgumentsToArrays: false,
  compareNullProtoToObjectProto: false,
}

// Holds the disabled state of all flags. This is used in `deriveFlags()` to default flags to their disabled state.
const disabledFlags: Flags = {
  compareArgumentsToArrays: false,
  compareNullProtoToObjectProto: false,
}

export type Flags = typeof flags

/**
 * Internal helper that expands a partial flags object with defaults,
 * or returns a frozen copy of the defaults if input is undefined
 */
export function normalizeFlags(input?: Readonly<Partial<Flags>>): Readonly<Flags> {
  // Start with defaults and override with any provided values (if any)
  return Object.freeze({ ...flags, ...input })
}

const isValidInput = (input: unknown): input is Record<string, unknown> => {
  return typeof input === 'object' && input !== null
}

/**
 * Derives a flags object from user input. Any known flag is preserved,
 * any unknown flag is quietly discarded. Any flag not specified defaults to
 * the disabled state.
 */
export function deriveFlags(input?: unknown): Readonly<Flags> {
  const normalized: Record<string, unknown> = { ...disabledFlags }

  if (!isValidInput(input)) {
    return Object.freeze(normalized) as Readonly<Flags> // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
  }

  // Only copy valid flag properties with matching types
  for (const [key, defaultValue] of Object.entries(flags)) {
    if (key in input && typeof input[key] === typeof defaultValue) {
      normalized[key] = input[key]
    }
  }

  return Object.freeze(normalized) as Readonly<Flags> // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
}
