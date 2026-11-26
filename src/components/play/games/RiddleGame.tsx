import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDeviceId } from '@/hooks/useDeviceId';
import {
  useMinigameTodayScore,
  useSubmitMinigameScore,
  useMinigameLeaderboardRound,
  todayDate,
  dateSeed,
} from '@/hooks/useMinigameScore';
import { RIDDLES, isRightAnswer } from '@/lib/riddles';
import { buzz } from '@/lib/haptics';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';

const GAME_ID = 'riddle';
const MAX_TRIES = 3;
const POINTS_BY_TRY = [30, 20, 10];

interface RiddleGameProps {
  playerName: string;
  roundId?: string;
}

/** Right vs wrong across the office for today's riddle. */
function OfficeTally({ right, wrong, highlight }: { right: number; wrong: number; highlight?: 'right' | 'wrong' }) {
  const total = right + wrong;
  const pct = total ? Math.round((right / total) * 100) : 0;
  return (
    <div className="space-y-2 rounded-xl bg-secondary/40 p-3">
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>Office today</span>
        <span className="tabular-nums">{total} answered</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-green-600 grow-x" style={{ width: `${pct}%` }} />
        <div className="h-full flex-1 bg-destructive/70" style={{ opacity: wrong ? 1 : 0 }} />
      </div>
      <div className="flex justify-between text-sm tabular-nums">
        <span className={`flex items-center gap-1 ${highlight === 'right' ? 'font-semibold' : ''}`}>
          <CheckCircle2 className="h-4 w-4 text-green-600" /> {right} got it
        </span>
        <span className={`flex items-center gap-1 ${highlight === 'wrong' ? 'font-semibold' : ''}`}>
          {wrong} didn&rsquo;t <XCircle className="h-4 w-4 text-destructive" />
        </span>
      </div>
    </div>
  );
}

export function RiddleGame({ playerName, roundId }: RiddleGameProps) {
  const deviceId = useDeviceId();
  const { data: todayScore } = useMinigameTodayScore(GAME_ID, playerName, roundId);
  const { data: allScores = [] } = useMinigameLeaderboardRound(GAME_ID, roundId);
  const submitScore = useSubmitMinigameScore();

  const riddleIndex = useMemo(() => dateSeed(`${roundId ?? todayDate()}-riddle`) % RIDDLES.length, [roundId]);
  const riddle = RIDDLES[riddleIndex];

  const [guess, setGuess] = useState('');
  const [misses, setMisses] = useState<string[]>([]);
  const [result, setResult] = useState<'right' | 'wrong' | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [points, setPoints] = useState(0);

  // One row per player (the best one), so retries elsewhere don't double count
  const tally = useMemo(() => {
    const byPlayer = new Map<string, boolean>();
    for (const s of allScores) {
      const right = s.score > 0;
      byPlayer.set(s.player_name, (byPlayer.get(s.player_name) ?? false) || right);
    }
    const values = [...byPlayer.values()];
    return { right: values.filter(Boolean).length, wrong: values.filter((v) => !v).length };
  }, [allScores]);

  const finish = async (right: boolean, tries: number) => {
    const score = right ? POINTS_BY_TRY[tries - 1] ?? 10 : 0;
    setResult(right ? 'right' : 'wrong');
    setPoints(score);
    buzz(right ? [15, 50, 15, 50, 30] : 80);
    await submitScore.mutateAsync({
      game_id: GAME_ID,
      player_name: playerName,
      device_id: deviceId,
      score,
      round_id: roundId,
      meta: { correct: right, tries, riddle: riddleIndex },
    });
  };

  const submit = () => {
    const g = guess.trim();
    if (!g || result) return;
    if (isRightAnswer(g, riddle)) {
      finish(true, misses.length + 1);
      return;
    }
    const nextMisses = [...misses, g];
    setMisses(nextMisses);
    setGuess('');
    setShakeKey((k) => k + 1);
    buzz(40);
    if (nextMisses.length >= MAX_TRIES) finish(false, MAX_TRIES);
  };

  // Played earlier today (and not just now): summary with the answer and the office tally
  if (todayScore && !result) {
    const wasRight = todayScore.score > 0;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">🧩 Riddle of the day</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-base font-semibold leading-snug">{riddle.question}</p>
          <p className="text-sm">
            Answer: <strong className="capitalize">{riddle.answers[0]}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            {wasRight ? `You got it, +${todayScore.score} pts.` : 'This one beat you today. New riddle tomorrow.'}
          </p>
          <OfficeTally right={tally.right} wrong={tally.wrong} highlight={wasRight ? 'right' : 'wrong'} />
        </CardContent>
      </Card>
    );
  }

  const triesLeft = MAX_TRIES - misses.length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">🧩 Riddle of the day</CardTitle>
        <p className="text-xs text-muted-foreground">
          {MAX_TRIES} tries. {POINTS_BY_TRY.join(' / ')} pts depending on the try.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <blockquote className="rounded-xl bg-primary/10 px-4 py-5 text-center text-lg font-semibold leading-snug text-balance animate-in fade-in zoom-in-95 duration-500">
          {riddle.question}
        </blockquote>

        {!result ? (
          <>
            <form
              key={shakeKey}
              className={`flex gap-2 ${shakeKey > 0 ? 'wordle-shake' : ''}`}
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <Input
                value={guess}
                onChange={(e) => setGuess(e.target.value.slice(0, 40))}
                placeholder="Your answer"
                autoComplete="off"
                autoCapitalize="none"
                className="h-11 text-base"
              />
              <Button type="submit" className="h-11 px-5" disabled={!guess.trim() || submitScore.isPending}>
                Guess
              </Button>
            </form>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {Array.from({ length: MAX_TRIES }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-full transition-colors ${i < misses.length ? 'bg-destructive' : 'bg-muted-foreground/30'}`}
                  />
                ))}
                <span className="ml-1">{triesLeft} {triesLeft === 1 ? 'try' : 'tries'} left</span>
              </span>
              <button type="button" className="underline-offset-2 hover:underline" onClick={() => finish(false, misses.length)}>
                Give up
              </button>
            </div>

            {misses.length > 0 && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                <p className="text-sm">
                  Not quite. You tried: <span className="text-muted-foreground">{misses.join(', ')}</span>
                </p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Lightbulb className="h-4 w-4 text-yellow-500" /> Hint: {riddle.hint}
                </p>
              </div>
            )}

            {tally.right + tally.wrong > 0 && (
              <p className="text-xs text-muted-foreground">
                {tally.right} of {tally.right + tally.wrong} in the office got it so far.
              </p>
            )}
          </>
        ) : (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {result === 'right' ? (
              <div className="text-center">
                <p className="text-3xl">🎉</p>
                <p className="font-semibold">You got it{misses.length ? ` on try ${misses.length + 1}` : ' first time'}!</p>
                <p className="text-sm text-muted-foreground">
                  The answer: <span className="font-medium capitalize text-foreground">{riddle.answers[0]}</span>
                </p>
                <p className="mt-1 text-3xl font-bold text-primary tabular-nums animate-in zoom-in-50 duration-500">+{points} pts</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="font-semibold">The answer was</p>
                <p className="text-2xl font-bold capitalize">{riddle.answers[0]}</p>
              </div>
            )}
            <OfficeTally
              // Count this answer straight away, before the saved score comes back
              right={tally.right + (result === 'right' && !allScores.some((s) => s.player_name === playerName) ? 1 : 0)}
              wrong={tally.wrong + (result === 'wrong' && !allScores.some((s) => s.player_name === playerName) ? 1 : 0)}
              highlight={result}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
