/** Reads a Padelion colour token for three.js, which cannot use CSS variables. */
export function tokenColor(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
