import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore, todayDate, dateSeed, seededShuffle } from '@/hooks/useMinigameScore';
import { useMinigameSettings } from '@/hooks/useMinigameSettings';
import { CheckCircle, Clock } from 'lucide-react';

const GAME_ID = 'pairs';

const EMOJIS = ['🌸', '🌊', '🔥', '⭐', '🎵', '🍕', '🚀', '🎨'];

interface PairsGameProps {
  playerName: string;
  roundId?: string;
}

export function PairsGame({ playerName, roundId }: PairsGameProps) {
  const deviceId = useDeviceId();
  const settings = useMinigameSettings();
  const { data: todayScore } = useMinigameTodayScore(GAME_ID, playerName, roundId);
  const submitScore = useSubmitMinigameScore();

  const tiles = useMemo(() => {
    const seed = dateSeed(todayDate());
    const pairs = [...EMOJIS, ...EMOJIS]; // 16 tiles = 8 pairs
    return seededShuffle(pairs, seed);
  }, []);

  const [revealed, setRevealed] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const lockRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (startTime && !done) {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [startTime, done]);

  const handleFlip = async (idx: number) => {
    if (lockRef.current || matched.has(idx) || revealed.includes(idx)) return;
    if (!startTime) setStartTime(Date.now());

    const newRevealed = [...revealed, idx];
    setRevealed(newRevealed);

    if (newRevealed.length === 2) {
      setMoves(m => m + 1);
      lockRef.current = true;
      const [a, b] = newRevealed;
      if (tiles[a] === tiles[b]) {
        const newMatched = new Set(matched);
        newMatched.add(a);
        newMatched.add(b);
        setMatched(newMatched);
        setRevealed([]);
        lockRef.current = false;

        // Check win
        if (newMatched.size === tiles.length) {
          setDone(true);
          const time = Math.floor((Date.now() - (startTime ?? Date.now())) / 1000);
          const totalMoves = moves + 1;
          const timeScore = Math.round(settings.pairs_max_points / (1 + time / settings.pairs_time_param));
          const movePenalty = Math.max(0, (totalMoves - 8) * settings.pairs_move_penalty); // 8 is perfect
          const score = Math.max(1, timeScore - movePenalty);
          await submitScore.mutateAsync({
            game_id: GAME_ID,
            player_name: playerName,
            device_id: deviceId,
            score,
            round_id: roundId,
            meta: { time_seconds: time, moves: totalMoves },
          });
        }
      } else {
        setTimeout(() => {
          setRevealed([]);
          lockRef.current = false;
        }, 800);
      }
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (todayScore) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">🃏 Pairs</CardTitle></CardHeader>
        <CardContent className="text-center py-6 space-y-2">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
          <p className="font-medium">{todayScore.score} pts</p>
          <p className="text-xs text-muted-foreground">
            {(todayScore.meta as any)?.moves} moves · {formatTime((todayScore.meta as any)?.time_seconds ?? 0)}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">🃏 Pairs</CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(elapsed)}</span>
          <span>{moves} moves</span>
          <span className="ml-auto">{matched.size / 2}/8 pairs</span>
        </div>
      </CardHeader>
      <CardContent className="px-1">
        <div className="grid grid-cols-4 gap-1 w-full">
          {tiles.map((emoji, i) => {
            const isRevealed = revealed.includes(i) || matched.has(i);
            return (
              <button
                key={i}
                onClick={() => handleFlip(i)}
                className={`aspect-square rounded-xl text-4xl flex items-center justify-center transition-all duration-200
                  ${matched.has(i) ? 'bg-primary/20 border-2 border-primary scale-95' :
                    isRevealed ? 'bg-secondary border-2 border-accent' :
                    'bg-muted border-2 border-border active:bg-muted/70 cursor-pointer'}`}
              >
                {isRevealed ? emoji : <span className="text-2xl text-muted-foreground font-bold">?</span>}
              </button>
            );
          })}
        </div>
        {done && (
          <p className="text-center font-semibold text-primary mt-3">🎉 All matched!</p>
        )}
      </CardContent>
    </Card>
  );
}
