/**
 * Kudos helpers: find who a message is about, and which week it belongs to.
 *
 * People are tagged with "@Name" (like Bob's shoutouts). A name that matches a
 * player is "known" (they're signed up); anything else after "@" is still tagged
 * but marked as not signed up yet, so the TV can invite them. Players' names
 * written without "@" are picked up too.
 */

export type KudosSegment = { text: string } | { name: string; known: boolean };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseKudos(message: string, playerNames: string[]): { segments: KudosSegment[]; tagged: { name: string; known: boolean }[] } {
  // Longest names first so "Ana Maria" wins over "Ana"
  const known = [...new Set(playerNames.filter((n) => n && n.trim().length >= 2))].sort((a, b) => b.length - a.length);
  const knownAlt = known.map(escapeRe).join("|");
  // @Known Name | @word | Known Name (whole word)
  const pattern = new RegExp(
    [knownAlt && `@(${knownAlt})(?![\\p{L}\\d])`, `@([\\p{L}][\\p{L}\\d'\\-]*)`, knownAlt && `(?<![\\p{L}\\d@])(${knownAlt})(?![\\p{L}\\d])`]
      .filter(Boolean)
      .join("|"),
    "giu"
  );

  const segments: KudosSegment[] = [];
  const tagged = new Map<string, { name: string; known: boolean }>();
  let last = 0;
  for (const m of message.matchAll(pattern)) {
    const raw = m[1] ?? m[2] ?? m[3];
    if (!raw || m.index === undefined) continue;
    const match = known.find((n) => n.toLowerCase() === raw.toLowerCase());
    const name = match ?? raw;
    const isKnown = !!match;
    if (m.index > last) segments.push({ text: message.slice(last, m.index) });
    segments.push({ name, known: isKnown });
    if (!tagged.has(name.toLowerCase())) tagged.set(name.toLowerCase(), { name, known: isKnown });
    last = m.index + m[0].length;
  }
  if (last < message.length) segments.push({ text: message.slice(last) });
  return { segments, tagged: [...tagged.values()] };
}

/** Monday 00:00 in Stockholm for the current week, as a Date. Kudos on the TV reset then. */
export function startOfWeekStockholm(now = new Date()): Date {
  const tz = "Europe/Stockholm";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday);
  // Midnight Stockholm of today, then step back to Monday
  const localMidnightUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
  const offsetMs = new Date(now.toLocaleString("en-US", { timeZone: tz })).getTime() - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(localMidnightUtc - offsetMs - dow * 86_400_000);
}

/* ── How long kudos stay on the TV ──────────────────────────────────────── */

export const KUDOS_DEFAULT_DAYS = 7;
export const KUDOS_MIN_DAYS = 1;
export const KUDOS_MAX_DAYS = 30;
const DAY_MS = 86_400_000;

/** When a kudos leaves the TV. Kudos from before end dates existed: 7 days after posting. */
export function kudosEndsAt(m: { created_at: string; expires_at?: string | null }): number {
  return m.expires_at ? Date.parse(m.expires_at) : Date.parse(m.created_at) + KUDOS_DEFAULT_DAYS * DAY_MS;
}

export const isKudosLive = (m: { created_at: string; expires_at?: string | null }, now = Date.now()) => kudosEndsAt(m) > now;

/** Whole days left, rounded up (a kudos ending in 20 hours has "1 day" left). 0 once it has ended. */
export function kudosDaysLeft(m: { created_at: string; expires_at?: string | null }, now = Date.now()): number {
  return Math.max(0, Math.ceil((kudosEndsAt(m) - now) / DAY_MS));
}

/** End date for "show for N days from now" */
export const kudosEndInDays = (days: number, now = Date.now()) => new Date(now + days * DAY_MS).toISOString();
