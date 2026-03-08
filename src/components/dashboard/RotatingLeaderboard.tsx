import { usePollRotations } from "@/contexts/pollRotation";
import { Leaderboard } from "./Leaderboard";
import { WordleLeaderboard } from "@/components/play/WordleLeaderboard";
import { Progress } from "@/components/ui/progress";
import { ROTATE_SECONDS } from "@/components/dashboard/PollDisplay";

/**
 * Rotates between GeoGuessr and Wordle leaderboards every poll rotation cycle (30s).
 */
export function RotatingLeaderboard() {
  const { rotations, pollTimeLeft } = usePollRotations();
  const showWordle = rotations % 2 === 1;

  const progressBar = (
    <Progress value={(pollTimeLeft / ROTATE_SECONDS) * 100} className="h-[clamp(3px,0.2vw,6px)]" />
  );

  return showWordle
    ? <WordleLeaderboard dashboard progressBar={progressBar} />
    : <Leaderboard progressBar={progressBar} />;
}
