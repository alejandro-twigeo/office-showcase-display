import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, CheckCircle2 } from 'lucide-react';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useSubmitMinigameScore } from '@/hooks/useMinigameScore';
import { useOfficeActivity, TEAM_RIDDLE_CLUE_AT, weekIndex } from '@/hooks/useOfficeActivity';
import { teamRiddleForWeek, asRiddle } from '@/lib/teamRiddles';
import { isRightAnswer } from '@/lib/riddles';
import { buzz } from '@/lib/haptics';

const GAME_ID = 'team_riddle';
const POINTS = 25;

interface TeamRiddleGameProps {
  playerName: string;
  roundId?: string;
}

/** Weekly "who or what am I?". Clues unlock as the whole office plays; guess as often as you like. */
export function TeamRiddleGame({ playerName, roundId }: TeamRiddleGameProps) {
  const a = useOfficeActivity();
  const deviceId = useDeviceId();
  const submit = useSubmitMinigameScore();
  const riddle = teamRiddleForWeek(weekIndex(a.today));
  const [guess, setGuess] = useState('');
  const [misses, setMisses] = useState<string[]>([]);
  const [shake, setShake] = useState(0);
  const [justSolved, setJustSolved] = useState(false);

  const solvers = a.teamRiddleSolves;
  const iSolved = justSolved || solvers.some((s) => s.player === playerName);
  const unlocked = TEAM_RIDDLE_CLUE_AT.filter((n) => a.playsThisWeek >= n).length;
  const nextAt = TEAM_RIDDLE_CLUE_AT[unlocked];

  const onGuess = async () => {
    const g = guess.trim();
    if (!g || iSolved) return;
    if (isRightAnswer(g, asRiddle(riddle))) {
      setJustSolved(true);
      buzz([15, 50, 15, 50, 30]);
      await submit.mutateAsync({
        game_id: GAME_ID,
        player_name: playerName,
        device_id: deviceId,
        score: POINTS,
        round_id: roundId,
        meta: { week: a.thisWeek, clues: unlocked },
      });
      return;
    }
    setMisses((m) => [...m, g]);
    setGuess('');
    setShake((k) => k + 1);
    buzz(40);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">🧠 Team riddle of the week</CardTitle>
        <p className="text-xs text-muted-foreground">
          Who or what am I? Every game anyone plays this week unlocks the next clue.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-2">
          {riddle.clues.map((clue, i) => {
            const open = i < unlocked;
            return (
              <li key={i} className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm ${open ? 'bg-primary/10' : 'bg-secondary/40 text-muted-foreground'}`}>
                <span className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold ${open ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {i + 1}
                </span>
                {open ? (
                  <span className="leading-snug animate-in fade-in duration-500">{clue}</span>
                ) : (
                  // Locked: how far the office is from unlocking it
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5" /> Unlocks at {TEAM_RIDDLE_CLUE_AT[i]} office games
                      </span>
                      <span className="shrink-0 tabular-nums text-xs">
                        {Math.min(a.playsThisWeek, TEAM_RIDDLE_CLUE_AT[i])}/{TEAM_RIDDLE_CLUE_AT[i]}
                      </span>
                    </span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className={`block h-full rounded-full transition-[width] duration-700 ${i === unlocked ? 'bg-primary' : 'bg-primary/40'}`}
                        style={{ width: `${Math.min(100, (a.playsThisWeek / TEAM_RIDDLE_CLUE_AT[i]) * 100)}%` }}
                      />
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {nextAt !== undefined && (
          <p className="text-xs text-muted-foreground">
            {nextAt - a.playsThisWeek} more {nextAt - a.playsThisWeek === 1 ? 'game' : 'games'} by anyone unlocks clue {unlocked + 1}. Play one!
          </p>
        )}

        {iSolved ? (
          <div className="space-y-1 rounded-xl bg-green-600/10 p-3 text-center animate-in fade-in zoom-in-95 duration-500">
            <p className="flex items-center justify-center gap-1.5 font-semibold">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> You cracked it!
            </p>
            <p className="text-sm">
              It&rsquo;s <strong className="capitalize">{riddle.answers[0]}</strong>
              {justSolved && <span className="text-primary font-semibold"> · +{POINTS} pts</span>}
            </p>
            <p className="text-xs text-muted-foreground">Keep it secret, so the others can crack it too.</p>
          </div>
        ) : (
          <>
            <form
              key={shake}
              className={`flex gap-2 ${shake > 0 ? 'wordle-shake' : ''}`}
              onSubmit={(e) => {
                e.preventDefault();
                onGuess();
              }}
            >
              <Input
                value={guess}
                onChange={(e) => setGuess(e.target.value.slice(0, 40))}
                placeholder="I think it's…"
                autoComplete="off"
                autoCapitalize="none"
                className="h-11 text-base"
              />
              <Button type="submit" className="h-11 px-5" disabled={!guess.trim() || submit.isPending}>
                Guess
              </Button>
            </form>
            {misses.length > 0 && (
              <p className="text-sm animate-in fade-in">
                Not it. You tried: <span className="text-muted-foreground">{misses.join(', ')}</span>
              </p>
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          {solvers.length === 0
            ? 'Nobody has cracked it yet this week.'
            : `Cracked by ${solvers.map((s) => s.player).slice(0, 3).join(', ')}${solvers.length > 3 ? ` and ${solvers.length - 3} more` : ''}.`}
        </p>
      </CardContent>
    </Card>
  );
}
