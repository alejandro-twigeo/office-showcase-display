// Curated list of common 5-letter words for Wordle
// We use a deterministic pick based on round_number so all players get the same word
export const WORDLE_WORDS = [
  "crane", "slate", "trace", "crate", "stare",
  "sharp", "mount", "cloud", "beach", "flame",
  "grape", "house", "lemon", "world", "blaze",
  "dance", "stone", "pride", "grace", "plant",
  "river", "light", "dream", "crown", "spark",
  "frost", "bloom", "quest", "swift", "brave",
  "charm", "ghost", "ocean", "piano", "tiger",
  "angel", "brush", "cabin", "delta", "epoch",
  "flint", "globe", "haven", "ivory", "joker",
  "kneel", "lunar", "mango", "noble", "oasis",
  "pearl", "reign", "solar", "trail", "unity",
  "vivid", "wheat", "xenon", "yield", "zesty",
  "ample", "bison", "cedar", "dwarf", "eagle",
  "fungi", "glyph", "husky", "inbox", "jewel",
  "kayak", "lilac", "moose", "ninja", "olive",
  "plumb", "quilt", "robin", "spice", "thumb",
  "ultra", "vigor", "waltz", "yacht", "zebra",
  "alarm", "bliss", "climb", "drift", "ember",
  "feast", "growl", "haste", "inner", "jolly",
  "knock", "latch", "maple", "nerve", "orbit",
  "patch", "quirk", "rusty", "shelf", "treat",
];

/** Pick the daily word deterministically from round number */
export function getWordForRound(roundNumber: number): string {
  return WORDLE_WORDS[roundNumber % WORDLE_WORDS.length];
}

/** All valid guess words (same list for simplicity - any 5-letter word is accepted) */
export function isValidWord(word: string): boolean {
  return word.length === 5 && /^[a-z]+$/.test(word);
}
