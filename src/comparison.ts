// Values are unequal.
export const unequal = 0

// Values are strictly equal, meaning they are the same object, primitive value or byte sequence.
export const strictlyEqual = 1

// Values are deeply equal, meaning all nested values are equal.
export const deeplyEqual = 2

// Values are possibly equal, but not enough data is available to know for sure.
export const possiblyEqual = 3

// Values have the same constructor and string tag, meaning they can be compared in more detail.
export const comparable = 4

export type Comparison =
  | typeof unequal
  | typeof strictlyEqual
  | typeof deeplyEqual
  | typeof possiblyEqual
  | typeof comparable

export type Condition = 'if-plain' | 'from-array-like' | 'from-arguments-object' | 'from-sparse'

export type Mode = 'comprehensive' | 'fuzzy'
