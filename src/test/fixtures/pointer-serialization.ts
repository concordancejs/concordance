const foo = {}
export const tree = {
  foo,
  bar: { foo },
}

export const binFile = new URL('pointer-serialization.bin', import.meta.url)
