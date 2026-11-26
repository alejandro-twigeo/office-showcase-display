import type { Riddle } from "./riddles";

/**
 * Team riddle of the week: a "who/what am I?" with five clues. Clue 1 is free; the others unlock
 * as the whole office plays games during the week, so everyone's games help crack it.
 */
export interface TeamRiddle {
  clues: string[];
  answers: string[];
}

export const TEAM_RIDDLES: TeamRiddle[] = [
  {
    clues: ["I'm about 330 metres tall.", "I was meant to stand for only 20 years.", "I'm repainted every seven years.", "I was built for a world fair in 1889.", "You'll find me on the Champ de Mars."],
    answers: ["eiffel tower", "tour eiffel", "eiffel"],
  },
  {
    clues: ["I have no legs but I travel far.", "I'm made of paper, plastic or metal.", "People collect me in albums.", "I carry a picture of a ruler or a famous person.", "You trade me at the bank for other kinds of me."],
    answers: ["money", "banknote", "bank note", "coin", "currency", "cash"],
  },
  {
    clues: ["I was born in Sweden in 1943.", "I have more stores than most fast food chains.", "My name is made of the founder's initials and where he grew up.", "I'm famous for flat boxes and tiny tools.", "Meatballs are part of my menu."],
    answers: ["ikea"],
  },
  {
    clues: ["I'm the largest of my kind in the solar system.", "A storm on me has lasted for centuries.", "I have more than 90 moons.", "I'm named after the king of the Roman gods.", "I'm the fifth from the Sun."],
    answers: ["jupiter"],
  },
  {
    clues: ["I'm green but I'm not a plant.", "I was a gift from one country to another.", "I hold a tablet with a date on it.", "I've stood on an island since 1886.", "I raise a torch over New York harbour."],
    answers: ["statue of liberty", "lady liberty", "liberty"],
  },
  {
    clues: ["I'm a game, but I'm also a word.", "I came from a software engineer as a gift to his partner.", "A newspaper bought me in 2022.", "I give you six tries.", "My tiles turn green, yellow or grey."],
    answers: ["wordle"],
  },
  {
    clues: ["I'm cold but I'm not ice cream.", "I move, but very slowly.", "I carve valleys.", "I'm shrinking almost everywhere.", "I'm a river of ice."],
    answers: ["glacier"],
  },
  {
    clues: ["I'm a city on a sea, not an ocean.", "I've been called the Pearl of the Black Sea.", "I'm Bulgaria's third-largest city.", "Twigeo has people working in me.", "My name starts with V."],
    answers: ["varna"],
  },
  {
    clues: ["I'm a break, but nothing gets broken.", "I need coffee to exist.", "I'm a verb and a noun.", "Cinnamon buns often come with me.", "I'm a Swedish tradition, usually around 3pm."],
    answers: ["fika"],
  },
  {
    clues: ["I'm made of 64 squares.", "I have kings and queens but no country.", "I've been played for about 1,500 years.", "A computer beat the world champion at me in 1997.", "Checkmate ends me."],
    answers: ["chess"],
  },
  {
    clues: ["I'm built on 14 islands.", "I'm a capital city.", "The Nobel banquet is held in me.", "My old town is called Gamla Stan.", "Twigeo's home office is in me."],
    answers: ["stockholm"],
  },
  {
    clues: ["I have keys but no doors.", "I have space but no room.", "You can enter, but not go inside.", "I'm usually QWERTY.", "You're probably touching me right now."],
    answers: ["keyboard"],
  },
];

export function teamRiddleForWeek(weekIdx: number): TeamRiddle {
  const n = TEAM_RIDDLES.length;
  return TEAM_RIDDLES[((weekIdx % n) + n) % n];
}

/** Shape it like a riddle so the same forgiving answer checker can be used. */
export function asRiddle(t: TeamRiddle): Riddle {
  return { question: t.clues.join(" "), answers: t.answers, hint: "" };
}
