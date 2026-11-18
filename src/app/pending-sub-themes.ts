export function addPendingSubTheme(pending: string[], name: string): string[] {
  return [...new Set([...pending, name])]
}
