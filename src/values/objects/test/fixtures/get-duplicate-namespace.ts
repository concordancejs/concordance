// This function imports the same module again to get a different namespace object
// with the same exports
export default async function getDuplicateNamespace() {
  const duplicate = await import('./module-fixture.ts')
  return duplicate
}
