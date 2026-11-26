/** Tiny vibration on phones that support it; silently does nothing elsewhere (iOS Safari included). */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
