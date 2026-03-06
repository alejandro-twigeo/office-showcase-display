import { usePollRotations } from "@/contexts/pollRotation";
import { Leaderboard } from "./Leaderboard";
import { WordleLeaderboard } from "@/components/play/WordleLeaderboard";

/**
 * Rotates between GeoGuessr and Wordle leaderboards every poll rotation cycle (30s).
 */
export function RotatingLeaderboard() {
  const { rotations } = usePollRotations();
  const showWordle = rotations % 2 === 1;

  return showWordle ? <WordleLeaderboard dashboard /> : <Leaderboard />;
}
