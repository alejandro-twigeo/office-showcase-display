import { useState, useEffect, useRef } from "react";
import { Leaderboard } from "./Leaderboard";
import { WordleLeaderboard } from "@/components/play/WordleLeaderboard";
import { MinigameLeaderboard } from "@/components/play/MinigameLeaderboard";
import { Progress } from "@/components/ui/progress";

const LEADERBOARD_ROTATE_SECONDS = 15;

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
 * Rotates between all game leaderboards every 15 seconds (independent of poll rotation).
 */
export function RotatingLeaderboard() {
  const [rotation, setRotation] = useState(0);
  const [timeLeft, setTimeLeft] = useState(LEADERBOARD_ROTATE_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setRotation(r => r + 1);
          return LEADERBOARD_ROTATE_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const idx = rotation % GAME_ROTATION.length;
  const current = GAME_ROTATION[idx];

  const progressBar = (
    <Progress value={(timeLeft / LEADERBOARD_ROTATE_SECONDS) * 100} className="h-[clamp(3px,0.2vw,6px)]" />
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
  return <Leaderboard dashboard progressBar={progressBar} />;
}
