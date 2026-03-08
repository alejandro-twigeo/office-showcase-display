import { usePollRotations } from "@/contexts/pollRotation";
import { Leaderboard } from "./Leaderboard";
import { WordleLeaderboard } from "@/components/play/WordleLeaderboard";
import { MinigameLeaderboard } from "@/components/play/MinigameLeaderboard";
import { Progress } from "@/components/ui/progress";
import { ROTATE_SECONDS } from "@/components/dashboard/PollDisplay";

const GAME_ROTATION = [
  { type: 'geo' as const },
  { type: 'wordle' as const },
  { type: 'mini' as const, gameId: 'city_guess', title: 'City Guess', emoji: '🏙️' },
  { type: 'mini' as const, gameId: 'this_or_that', title: 'This or That', emoji: '⚖️' },
  { type: 'mini' as const, gameId: 'sudoku', title: 'Sudoku', emoji: '🔢' },
  { type: 'mini' as const, gameId: 'pairs', title: 'Pairs', emoji: '🃏' },
  { type: 'mini' as const, gameId: 'labyrinth', title: 'Labyrinth', emoji: '🌀' },
];

/**
 * Rotates between all game leaderboards every poll rotation cycle (30s).
 */
export function RotatingLeaderboard() {
  const { rotations, pollTimeLeft } = usePollRotations();
  const idx = rotations % GAME_ROTATION.length;
  const current = GAME_ROTATION[idx];

  const progressBar = (
    <Progress value={(pollTimeLeft / ROTATE_SECONDS) * 100} className="h-[clamp(3px,0.2vw,6px)]" />
  );

  if (current.type === 'wordle') {
    return <WordleLeaderboard dashboard progressBar={progressBar} />;
  }
  if (current.type === 'mini') {
    return (
      <MinigameLeaderboard
        dashboard
        gameId={current.gameId!}
        title={current.title!}
        emoji={current.emoji}
        progressBar={progressBar}
        formatMeta={(meta) => {
          if (meta.time_seconds != null) return `${Math.floor(meta.time_seconds / 60)}:${String(meta.time_seconds % 60).padStart(2, '0')}`;
          if (meta.moves != null) return `${meta.moves} moves`;
          if (meta.attempts != null) return `${meta.attempts} attempts`;
          return '';
        }}
      />
    );
  }
  return <Leaderboard progressBar={progressBar} />;
}
