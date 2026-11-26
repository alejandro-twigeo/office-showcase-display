import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore, todayDate, dateSeed, seededShuffle } from '@/hooks/useMinigameScore';
import { useMinigameSettings } from '@/hooks/useMinigameSettings';
import { useIsMobile } from '@/hooks/use-mobile';
import { CheckCircle, Clock } from 'lucide-react';

/** Tiny vibration on phones that support it; silently does nothing elsewhere. */
const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
};

const GAME_ID = 'pairs';

const EMOJIS = ['🌸', '🌊', '🔥', '⭐', '🎵', '🍕', '🚀', '🎨', '🌙', '🍀'];

interface PairsGameProps {
  playerName: string;
  roundId?: string;
}

export function PairsGame({ playerName, roundId }: PairsGameProps) {
  const isMobile = useIsMobile();
  const deviceId = useDeviceId();
  const settings = useMinigameSettings();
  const { data: todayScore } = useMinigameTodayScore(GAME_ID, playerName, roundId);
  const submitScore = useSubmitMinigameScore();

  const tiles = useMemo(() => {
    const seed = dateSeed(roundId ?? todayDate());
    const pairs = [...EMOJIS, ...EMOJIS]; // 20 tiles = 10 pairs
    return seededShuffle(pairs, seed);
  }, [roundId]);

  const [revealed, setRevealed] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [shaking, setShaking] = useState<number[]>([]);
  const [justMatched, setJustMatched] = useState<number[]>([]);
  const [finalScore, setFinalScore] = useState<number | null>(null);
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
    buzz(8);

    if (newRevealed.length === 2) {
      setMoves(m => m + 1);
      lockRef.current = true;
      const [a, b] = newRevealed;
      if (tiles[a] === tiles[b]) {
        const newMatched = new Set(matched);
        newMatched.add(a);
        newMatched.add(b);
        // Let the second card finish turning before it celebrates
        setTimeout(() => {
          setMatched(newMatched);
          setRevealed([]);
          setJustMatched([a, b]);
          buzz([12, 40, 18]);
          setTimeout(() => setJustMatched([]), 700);
          lockRef.current = false;
        }, 320);

        // Check win
        if (newMatched.size === tiles.length) {
          setDone(true);
          const time = Math.floor((Date.now() - (startTime ?? Date.now())) / 1000);
          const totalMoves = moves + 1;
          const timeScore = Math.round(settings.pairs_max_points / (1 + time / settings.pairs_time_param));
          const movePenalty = Math.max(0, (totalMoves - EMOJIS.length) * settings.pairs_move_penalty); // one move per pair is perfect
          const score = Math.max(1, timeScore - movePenalty);
          setTimeout(() => setFinalScore(score), 700);
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
        // Show both cards, shake "no", then turn them back
        setTimeout(() => {
          setShaking([a, b]);
          buzz(30);
        }, 450);
        setTimeout(() => {
          setShaking([]);
          setRevealed([]);
          lockRef.current = false;
        }, 950);
      }
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (todayScore && !done) {
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

  const pairsFound = matched.size / 2;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">🃏 Pairs</CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(elapsed)}</span>
          <span>{moves} moves</span>
          <span className="ml-auto">{pairsFound}/{EMOJIS.length} pairs</span>
        </div>
        {/* progress */}
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${(pairsFound / EMOJIS.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className={`relative ${isMobile ? 'px-2' : 'px-3'}`}>
        <div className={`grid grid-cols-4 gap-2 w-full ${isMobile ? '' : 'max-w-md lg:max-w-[22rem] mx-auto'}`}>
          {tiles.map((emoji, i) => {
            const isMatched = matched.has(i);
            const isOpen = revealed.includes(i) || isMatched;
            return (
              <button
                key={i}
                onClick={() => handleFlip(i)}
                aria-label={isOpen ? emoji : 'Hidden card'}
                className={`pairs-card aspect-square ${shaking.includes(i) ? 'pairs-shake' : ''} ${justMatched.includes(i) ? 'pairs-pop' : ''}`}
                disabled={isMatched || done}
              >
                <span className={`pairs-inner ${isOpen ? 'is-open' : ''}`}>
                  <span className="pairs-face pairs-back" aria-hidden />
                  <span
                    className={`pairs-face pairs-front text-[clamp(1.9rem,9vw,2.6rem)] lg:text-[clamp(1.6rem,1.9vw,2rem)] ${
                      isMatched ? 'is-matched' : shaking.includes(i) ? 'is-wrong' : ''
                    }`}
                  >
                    {emoji}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {done && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/85 animate-in fade-in duration-500">
            <div className="text-center animate-in zoom-in-95 duration-500">
              <p className="text-4xl">🎉</p>
              <p className="mt-2 text-lg font-semibold">All {EMOJIS.length} pairs!</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {moves} moves · {formatTime(elapsed)}
              </p>
              {finalScore !== null && (
                <p className="mt-3 text-3xl font-bold text-primary tabular-nums animate-in zoom-in-50 duration-500">{finalScore} pts</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
