/**
 * Song dedications ride on the queue's "queued_by" field: "Alejandro → Sara".
 * Anything without the arrow is a normal queue entry.
 */
export const DEDICATION_SEPARATOR = " → ";

export function dedicatedQueuedBy(from: string, to?: string | null) {
  return to ? `${from}${DEDICATION_SEPARATOR}${to}` : from;
}

export function parseQueuedBy(queuedBy?: string | null): { from: string; to: string | null } {
  const s = queuedBy ?? "";
  const i = s.indexOf(DEDICATION_SEPARATOR);
  if (i === -1) return { from: s, to: null };
  return { from: s.slice(0, i), to: s.slice(i + DEDICATION_SEPARATOR.length) };
}
