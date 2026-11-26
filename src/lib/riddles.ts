/**
 * Riddle of the day. One riddle per round, picked from this list with the round as the seed,
 * so everyone gets the same one. `answers` lists every wording we accept.
 */
export interface Riddle {
  question: string;
  answers: string[];
  hint: string;
}

export const RIDDLES: Riddle[] = [
  { question: "What has keys but can't open locks?", answers: ["piano", "keyboard"], hint: "You can play it" },
  { question: "What gets wetter the more it dries?", answers: ["towel"], hint: "Bathroom" },
  { question: "What has a neck but no head?", answers: ["bottle"], hint: "Wine comes in it" },
  { question: "What can travel around the world while staying in a corner?", answers: ["stamp", "postage stamp"], hint: "Look at an envelope" },
  { question: "What has hands but can't clap?", answers: ["clock", "watch"], hint: "Tick tock" },
  { question: "The more of this there is, the less you see. What is it?", answers: ["darkness", "dark", "fog"], hint: "Turn off the lights" },
  { question: "What has many teeth but can't bite?", answers: ["comb", "zipper", "saw"], hint: "Hair" },
  { question: "What goes up but never comes down?", answers: ["age", "your age"], hint: "Birthdays" },
  { question: "What has one eye but can't see?", answers: ["needle", "storm", "hurricane"], hint: "Sewing" },
  { question: "What can you catch but not throw?", answers: ["cold", "a cold", "flu"], hint: "Winter in Stockholm" },
  { question: "What has a head and a tail but no body?", answers: ["coin"], hint: "Flip it" },
  { question: "What breaks when you say its name?", answers: ["silence"], hint: "Shh" },
  { question: "What has words but never speaks?", answers: ["book"], hint: "Library" },
  { question: "What runs but never walks, has a mouth but never talks?", answers: ["river", "stream"], hint: "Water" },
  { question: "I'm tall when I'm young and short when I'm old. What am I?", answers: ["candle"], hint: "Birthday cake" },
  { question: "What has legs but doesn't walk?", answers: ["table", "chair", "desk"], hint: "Furniture" },
  { question: "What month has 28 days?", answers: ["all", "all of them", "every month", "all months"], hint: "Trick question" },
  { question: "What is full of holes but still holds water?", answers: ["sponge"], hint: "Kitchen sink" },
  { question: "What can fill a room but takes up no space?", answers: ["light", "air", "sound"], hint: "Flip a switch" },
  { question: "What has a thumb and four fingers but isn't alive?", answers: ["glove", "mitten"], hint: "Cold hands" },
  { question: "What goes through cities and fields but never moves?", answers: ["road", "street", "highway"], hint: "You drive on it" },
  { question: "What has a bottom at the top?", answers: ["leg", "legs", "your legs"], hint: "Body part" },
  { question: "What can you keep after giving it to someone?", answers: ["word", "your word", "promise"], hint: "A promise" },
  { question: "What kind of room has no doors or windows?", answers: ["mushroom"], hint: "It grows in the forest" },
  { question: "What has cities but no houses, forests but no trees, and water but no fish?", answers: ["map"], hint: "GeoGuessr players love it" },
  { question: "What gets bigger the more you take away from it?", answers: ["hole"], hint: "Dig" },
  { question: "What begins with T, ends with T, and has T in it?", answers: ["teapot"], hint: "Fika" },
  { question: "What is always in front of you but can't be seen?", answers: ["future", "the future"], hint: "Tomorrow" },
  { question: "What has 13 hearts but no other organs?", answers: ["deck of cards", "deck", "cards", "pack of cards"], hint: "Poker night" },
  { question: "What belongs to you but other people use it more than you do?", answers: ["name", "your name"], hint: "Hello, my ___ is" },
  { question: "What invention lets you look right through a wall?", answers: ["window"], hint: "Glass" },
  { question: "If you drop me I'm sure to crack, but smile at me and I'll smile back. What am I?", answers: ["mirror"], hint: "Bathroom wall" },
  { question: "What can run but never gets tired, and has a bed but never sleeps?", answers: ["river"], hint: "Flows to the sea" },
  { question: "What comes once in a minute, twice in a moment, but never in a thousand years?", answers: ["m", "letter m", "the letter m"], hint: "Spell it out" },
  { question: "The more you take, the more you leave behind. What are they?", answers: ["footsteps", "steps", "footprints"], hint: "Walk on snow" },
  { question: "What has an end but no beginning, a home but no family, and a space without room?", answers: ["keyboard"], hint: "You type on it" },
  { question: "What is so fragile that saying its name breaks it?", answers: ["silence"], hint: "Quiet" },
  { question: "What goes up and down but doesn't move?", answers: ["stairs", "staircase", "temperature"], hint: "Between floors" },
  { question: "What has a ring but no finger?", answers: ["phone", "telephone", "bell"], hint: "Call me" },
  { question: "What can you hold in your right hand but never in your left?", answers: ["left hand", "your left hand", "left elbow", "your left elbow"], hint: "Try it" },
  { question: "What has four wheels and flies?", answers: ["garbage truck", "rubbish truck", "trash truck", "bin lorry"], hint: "Not a plane" },
  { question: "What can be cracked, made, told and played?", answers: ["joke"], hint: "Ha ha" },
  { question: "Where does today come before yesterday?", answers: ["dictionary"], hint: "A to Z" },
  { question: "What has branches but no fruit, trunk or leaves?", answers: ["bank"], hint: "Money" },
  { question: "What is black when you buy it, red when you use it and grey when you throw it away?", answers: ["charcoal", "coal"], hint: "Barbecue" },
  { question: "What do you throw out when you want to use it, and take in when you're done?", answers: ["anchor"], hint: "Boats" },
  { question: "What has a spine but no bones?", answers: ["book"], hint: "Shelf" },
  { question: "What word is spelled wrong in every dictionary?", answers: ["wrong"], hint: "Read the question again" },
  { question: "What can you break without touching it?", answers: ["promise", "a promise", "record", "silence"], hint: "Keep it instead" },
  { question: "What has many keys, but can only open one door?", answers: ["piano"], hint: "Not a janitor" },
  { question: "What goes all around a field but doesn't move?", answers: ["fence"], hint: "Keeps the sheep in" },
  { question: "What tastes better than it smells?", answers: ["tongue", "your tongue"], hint: "In your mouth" },
  { question: "What has a face and two hands but no arms or legs?", answers: ["clock"], hint: "On the wall" },
  { question: "What comes down but never goes up?", answers: ["rain", "snow"], hint: "Weather" },
  { question: "What can't talk but will reply when spoken to?", answers: ["echo"], hint: "Mountains" },
  { question: "What has lots of eyes but can't see?", answers: ["potato"], hint: "Vegetable" },
  { question: "I shave every day, but my beard stays the same. What am I?", answers: ["barber"], hint: "A job" },
  { question: "What kind of band never plays music?", answers: ["rubber band", "elastic band", "hairband"], hint: "Office drawer" },
  { question: "What building has the most stories?", answers: ["library"], hint: "Books" },
  { question: "What is easy to get into but hard to get out of?", answers: ["trouble", "debt", "bed"], hint: "You don't want to be in it" },
];

/** Lowercase, drop punctuation and leading a/an/the, trim plural "s" so "Towels!" matches "towel". */
export function normaliseAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(a|an|the|my|your)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(\w{3,})s\b/g, "$1");
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Right if it matches an accepted answer, allowing one typo on longer words. */
export function isRightAnswer(guess: string, riddle: Riddle): boolean {
  const g = normaliseAnswer(guess);
  if (!g) return false;
  return riddle.answers.some((ans) => {
    const a = normaliseAnswer(ans);
    if (g === a) return true;
    if (a.length >= 5 && editDistance(g, a) <= 1) return true;
    // "it's a towel" style answers: the accepted word appears on its own
    return a.length >= 4 && new RegExp(`(^| )${a}( |$)`).test(g);
  });
}
