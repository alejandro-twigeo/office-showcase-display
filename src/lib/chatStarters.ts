/** Shown when the chat is quiet: small nudges to get people talking. */
export const CHAT_STARTERS = [
  "What's the best thing you ate this week?",
  "Lunch plans? Anyone up for trying somewhere new?",
  "What are you listening to right now? 🎧",
  "Weekend plans? Give us one highlight.",
  "Who needs a coffee? ☕",
  "Share one small win from today 🎉",
  "What's a tool or shortcut that saved you time lately?",
  "Recommend a show, book or podcast in 5 words",
  "Fika today? What are we having?",
  "What's the weather like where you are? 🌦️",
  "Hot take: the best office snack is…",
  "If today had a soundtrack, what would it be?",
  "What's something you learned this week?",
  "Who wants to team up for the Team riddle? 🧠",
  "Tag someone who helped you today 👏",
];

/** A starter that changes on its own every so often, same for everyone at the same moment */
export function starterAt(time: number, everyMs = 30_000) {
  return CHAT_STARTERS[Math.floor(time / everyMs) % CHAT_STARTERS.length];
}
