import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore, todayDate, dateSeed, seededShuffle } from '@/hooks/useMinigameScore';
import { useMinigameSettings } from '@/hooks/useMinigameSettings';
import { useIsMobile } from '@/hooks/use-mobile';
import { CheckCircle, Clock } from 'lucide-react';

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
  const lockRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const handleTilePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isMobile) return;
    const tile = event.currentTarget;
    const rect = tile.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const px = x / rect.width;
    const py = y / rect.height;
    const rotateY = (px - 0.5) * 10;
    const rotateX = (0.5 - py) * 10;
    const magnetX = (px - 0.5) * 10;
    const magnetY = (py - 0.5) * 10;

    tile.style.setProperty('--pairs-rotate-x', `${rotateX.toFixed(2)}deg`);
    tile.style.setProperty('--pairs-rotate-y', `${rotateY.toFixed(2)}deg`);
    tile.style.setProperty('--pairs-shift-x', `${magnetX.toFixed(2)}px`);
    tile.style.setProperty('--pairs-shift-y', `${magnetY.toFixed(2)}px`);
    tile.style.setProperty('--pairs-spotlight-x', `${x.toFixed(1)}px`);
    tile.style.setProperty('--pairs-spotlight-y', `${y.toFixed(1)}px`);
    tile.style.setProperty('--pairs-spotlight-opacity', '1');
  };

  const resetTilePointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isMobile) return;
    const tile = event.currentTarget;
    tile.style.setProperty('--pairs-rotate-x', '0deg');
    tile.style.setProperty('--pairs-rotate-y', '0deg');
    tile.style.setProperty('--pairs-shift-x', '0px');
    tile.style.setProperty('--pairs-shift-y', '0px');
    tile.style.setProperty('--pairs-spotlight-opacity', '0');
  };

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
          const movePenalty = Math.max(0, (totalMoves - EMOJIS.length) * settings.pairs_move_penalty); // one move per pair is perfect
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
          <span className="ml-auto">{matched.size / 2}/{EMOJIS.length} pairs</span>
        </div>
      </CardHeader>
      <CardContent className={isMobile ? 'px-0' : 'px-1 lg:px-3'}>
        <style>{`
          .pairs-magic-tile {
            transform:
              perspective(900px)
              translate3d(var(--pairs-shift-x, 0px), var(--pairs-shift-y, 0px), 0)
              rotateX(var(--pairs-rotate-x, 0deg))
              rotateY(var(--pairs-rotate-y, 0deg))
              scale3d(1, 1, 1);
            transform-style: preserve-3d;
            transition:
              transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1),
              background-color 180ms ease,
              border-color 180ms ease;
            will-change: transform;
          }

          .pairs-magic-tile::before {
            content: '';
            position: absolute;
            inset: -18%;
            pointer-events: none;
            background:
              radial-gradient(
                190px circle at var(--pairs-spotlight-x, 50%) var(--pairs-spotlight-y, 50%),
                rgba(249, 115, 22, 0.28) 0%,
                rgba(251, 146, 60, 0.18) 24%,
                rgba(251, 146, 60, 0.08) 42%,
                transparent 66%
              );
            opacity: var(--pairs-spotlight-opacity, 0);
            transition: opacity 180ms ease;
            z-index: 0;
          }

          .pairs-magic-tile > * {
            position: relative;
            z-index: 1;
          }
        `}</style>
        <div className={`grid grid-cols-4 gap-1 lg:gap-2 w-full ${isMobile ? '' : 'max-w-md lg:max-w-[22rem] mx-auto'}`}>
          {tiles.map((emoji, i) => {
            const isRevealed = revealed.includes(i) || matched.has(i);
            return (
              <button
                key={i}
                onClick={() => handleFlip(i)}
                onPointerMove={handleTilePointerMove}
                onPointerLeave={resetTilePointer}
                onPointerCancel={resetTilePointer}
                className={`pairs-magic-tile relative overflow-hidden aspect-square rounded-xl text-[clamp(2rem,5.2vw,2.7rem)] lg:text-[clamp(1.65rem,1.95vw,2.05rem)] flex items-center justify-center transition-all duration-200
                  ${matched.has(i) ? 'bg-primary/20 border-2 border-primary scale-95' :
                    isRevealed ? 'bg-secondary border-2 border-accent' :
                    'bg-muted border-2 border-border active:bg-muted/70 cursor-pointer'}`}
              >
                {isRevealed ? emoji : <span className="text-[clamp(1.3rem,3.6vw,1.9rem)] lg:text-[clamp(1.15rem,1.3vw,1.45rem)] text-muted-foreground font-bold">?</span>}
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
