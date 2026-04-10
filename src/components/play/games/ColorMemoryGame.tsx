import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore, dateSeed, seededRandom, todayDate } from '@/hooks/useMinigameScore';
import { CheckCircle } from 'lucide-react';

const GAME_ID = 'color_memory';
const MEMORIZE_SECONDS = 15;

type Phase = 'memorize' | 'reconstruct' | 'result';

interface HslColor {
  h: number;
  s: number;
  l: number;
}

interface ColorMemoryGameProps {
  playerName: string;
  roundId?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toCssHsl(color: HslColor) {
  return `hsl(${Math.round(color.h)} ${Math.round(color.s)}% ${Math.round(color.l)}%)`;
}

function buildRankedColor(roundId?: string): HslColor {
  const seed = dateSeed(`${roundId ?? todayDate()}-${GAME_ID}`);
  const rng = seededRandom(seed);
  return {
    h: Math.round(rng() * 359),
    s: Math.round(35 + rng() * 55),
    l: Math.round(25 + rng() * 50),
  };
}

function buildPracticeColor(): HslColor {
  return {
    h: Math.round(Math.random() * 359),
    s: Math.round(35 + Math.random() * 55),
    l: Math.round(25 + Math.random() * 50),
  };
}

function scoreColorMatch(target: HslColor, guess: HslColor) {
  const hueDelta = Math.min(Math.abs(target.h - guess.h), 360 - Math.abs(target.h - guess.h)) / 180;
  const satDelta = Math.abs(target.s - guess.s) / 100;
  const lightDelta = Math.abs(target.l - guess.l) / 100;

  // Hue should matter less when colors are very dark or washed out, because
  // people perceive those differences much less strongly there.
  const averageSaturation = (target.s + guess.s) / 200;
  const averageLightness = (target.l + guess.l) / 200;
  const darknessPenalty = 1 - Math.abs(averageLightness - 0.5) * 2;
  const hueVisibility = clamp(0.15 + averageSaturation * clamp(darknessPenalty, 0, 1), 0.15, 1);

  const hueComponent = hueDelta * (0.62 * hueVisibility);
  const saturationComponent = satDelta * 0.55;
  const lightnessComponent = lightDelta * 0.7;

  const distance = Math.sqrt(
    hueComponent ** 2 +
    saturationComponent ** 2 +
    lightnessComponent ** 2
  );

  const normalizedCloseness = clamp(1 - distance, 0, 1);
  return clamp(Math.round(normalizedCloseness ** 1.35 * 100), 0, 100);
}

function createStartingGuess(target: HslColor): HslColor {
  const candidates: HslColor[] = [
    {
      h: (target.h + 150) % 360,
      s: clamp(target.s > 55 ? target.s - 40 : target.s + 40, 8, 100),
      l: clamp(target.l > 50 ? target.l - 28 : target.l + 28, 8, 92),
    },
    {
      h: (target.h + 110) % 360,
      s: clamp(target.s > 50 ? target.s - 30 : target.s + 30, 8, 100),
      l: clamp(target.l > 50 ? target.l - 22 : target.l + 22, 8, 92),
    },
    {
      h: (target.h + 180) % 360,
      s: clamp(100 - target.s, 8, 100),
      l: clamp(100 - target.l, 8, 92),
    },
  ];

  return candidates.find((candidate) => scoreColorMatch(target, candidate) <= 55) ?? candidates[0];
}

function sliderBackground(metric: 'hue' | 'saturation' | 'lightness', color: HslColor) {
  if (metric === 'hue') {
    return 'linear-gradient(90deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 45%), hsl(180 100% 45%), hsl(240 100% 60%), hsl(300 100% 55%), hsl(360 100% 50%))';
  }
  if (metric === 'saturation') {
    return `linear-gradient(90deg, hsl(${Math.round(color.h)} 0% ${Math.round(color.l)}%), hsl(${Math.round(color.h)} 100% ${Math.round(color.l)}%))`;
  }
  return `linear-gradient(90deg, hsl(${Math.round(color.h)} ${Math.round(color.s)}% 0%), hsl(${Math.round(color.h)} ${Math.round(color.s)}% 50%), hsl(${Math.round(color.h)} ${Math.round(color.s)}% 100%))`;
}

function MetricRow({ label, metric, target, guess, targetColor, guessColor }: {
  label: string;
  metric: 'hue' | 'saturation' | 'lightness';
  target: number;
  guess: number;
  targetColor: HslColor;
  guessColor: HslColor;
}) {
  const max = metric === 'hue' ? 359 : 100;
  const suffix = metric === 'hue' ? '°' : '%';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm font-medium">
        <span>{label}</span>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span>T {Math.round(target)}{suffix}</span>
          <span>Y {Math.round(guess)}{suffix}</span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>Target</span>
          </div>
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={target}
            readOnly
            disabled
            className="h-3 w-full appearance-none rounded-full border border-border/60 opacity-100"
            style={{ background: sliderBackground(metric, metric === 'hue' ? { h: target, s: 100, l: 50 } : { ...targetColor, [metric === 'saturation' ? 's' : 'l']: target }) }}
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>Your Guess</span>
          </div>
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={guess}
            readOnly
            disabled
            className="h-3 w-full appearance-none rounded-full border border-border/60 opacity-100"
            style={{ background: sliderBackground(metric, metric === 'hue' ? { h: guess, s: 100, l: 50 } : { ...guessColor, [metric === 'saturation' ? 's' : 'l']: guess }) }}
          />
        </div>
      </div>
    </div>
  );
}

export function ColorMemoryGame({ playerName, roundId }: ColorMemoryGameProps) {
  const deviceId = useDeviceId();
  const submitScore = useSubmitMinigameScore();
  const { data: todayScore } = useMinigameTodayScore(GAME_ID, playerName, roundId);

  const rankedTarget = useMemo(() => buildRankedColor(roundId), [roundId]);
  const [targetColor, setTargetColor] = useState<HslColor>(rankedTarget);
  const [playerColor, setPlayerColor] = useState<HslColor>(() => createStartingGuess(rankedTarget));
  const [phase, setPhase] = useState<Phase>('memorize');
  const [secondsLeft, setSecondsLeft] = useState(MEMORIZE_SECONDS);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [hasSubmittedRankedRound, setHasSubmittedRankedRound] = useState(false);
  const [showRankedSummaryOnly, setShowRankedSummaryOnly] = useState(false);

  const startReconstruction = useCallback(() => {
    setPhase('reconstruct');
    setSecondsLeft(0);
  }, []);

  const startRound = useCallback((target: HslColor, practiceMode: boolean) => {
    setTargetColor(target);
    setPlayerColor(createStartingGuess(target));
    setPhase('memorize');
    setSecondsLeft(MEMORIZE_SECONDS);
    setIsPracticeMode(practiceMode);
    setLastScore(null);
    setShowRankedSummaryOnly(false);
  }, []);

  useEffect(() => {
    if (todayScore && !hasSubmittedRankedRound && lastScore == null) {
      setHasSubmittedRankedRound(true);
      setIsPracticeMode(true);
      setPhase('result');
      setLastScore(todayScore.score);
      setTargetColor(rankedTarget);
      setPlayerColor(createStartingGuess(rankedTarget));
      setShowRankedSummaryOnly(true);
    } else if (!todayScore) {
      setHasSubmittedRankedRound(false);
      startRound(rankedTarget, false);
    }
  }, [todayScore, rankedTarget, startRound, hasSubmittedRankedRound, lastScore]);

  useEffect(() => {
    if (phase !== 'memorize') return;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          startReconstruction();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, targetColor, startReconstruction]);

  const handleSubmit = async () => {
    const score = scoreColorMatch(targetColor, playerColor);
    setLastScore(score);
    setPhase('result');

    if (!isPracticeMode && !hasSubmittedRankedRound && deviceId) {
      await submitScore.mutateAsync({
        game_id: GAME_ID,
        player_name: playerName,
        device_id: deviceId,
        score,
        round_id: roundId,
        meta: {
          target_h: Math.round(targetColor.h),
          target_s: Math.round(targetColor.s),
          target_l: Math.round(targetColor.l),
          guess_h: Math.round(playerColor.h),
          guess_s: Math.round(playerColor.s),
          guess_l: Math.round(playerColor.l),
        },
      });
      setHasSubmittedRankedRound(true);
    }
  };

  const beginPractice = () => {
    startRound(buildPracticeColor(), true);
  };

  const rankedSummary = todayScore ? (
    <div className="rounded-2xl border bg-secondary/30 p-4 text-center space-y-2">
      <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
      <p className="font-medium">Ranked score: {todayScore.score}</p>
      <p className="text-xs text-muted-foreground">Ranked round already completed for this session.</p>
    </div>
  ) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Color Memory</CardTitle>
        {isPracticeMode && (
          <p className="text-xs font-medium text-muted-foreground">Practice mode - score not recorded</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {phase === 'memorize' && (
          <div
            className="relative h-[clamp(15rem,48vw,22rem)] rounded-3xl border"
            style={{ backgroundColor: toCssHsl(targetColor) }}
          >
            <div className="absolute right-4 top-4 text-[clamp(2.2rem,8vw,4rem)] font-black tracking-tight text-white mix-blend-difference">
              {secondsLeft}
            </div>
            <button
              type="button"
              onClick={startReconstruction}
              className="absolute inset-0 flex items-center justify-center text-[clamp(1rem,3.8vw,1.35rem)] font-semibold tracking-tight text-white mix-blend-difference"
            >
              Start now
            </button>
          </div>
        )}

        {phase === 'reconstruct' && (
          <div className="space-y-4">
            <div
              className="h-[clamp(15rem,48vw,22rem)] rounded-3xl border"
              style={{ backgroundColor: toCssHsl(playerColor) }}
            />
            <div className="space-y-4 rounded-2xl border bg-secondary/20 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Hue</span>
                  <span className="font-mono text-muted-foreground">{Math.round(playerColor.h)}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={359}
                  step={1}
                  value={playerColor.h}
                  onChange={(e) => setPlayerColor((current) => ({ ...current, h: Number(e.target.value) }))}
                  className="h-3 w-full cursor-pointer appearance-none rounded-full border border-border/60"
                  style={{ background: sliderBackground('hue', playerColor) }}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Saturation</span>
                  <span className="font-mono text-muted-foreground">{Math.round(playerColor.s)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={playerColor.s}
                  onChange={(e) => setPlayerColor((current) => ({ ...current, s: Number(e.target.value) }))}
                  className="h-3 w-full cursor-pointer appearance-none rounded-full border border-border/60"
                  style={{ background: sliderBackground('saturation', playerColor) }}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Lightness</span>
                  <span className="font-mono text-muted-foreground">{Math.round(playerColor.l)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={playerColor.l}
                  onChange={(e) => setPlayerColor((current) => ({ ...current, l: Number(e.target.value) }))}
                  className="h-3 w-full cursor-pointer appearance-none rounded-full border border-border/60"
                  style={{ background: sliderBackground('lightness', playerColor) }}
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={submitScore.isPending}>
              Submit
            </Button>
          </div>
        )}

        {phase === 'result' && (
          <div className="space-y-4">
            {showRankedSummaryOnly ? rankedSummary : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Target</p>
                    <div
                      className="h-32 rounded-2xl border"
                      style={{ backgroundColor: toCssHsl(targetColor) }}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Your Color</p>
                    <div
                      className="h-32 rounded-2xl border"
                      style={{ backgroundColor: toCssHsl(playerColor) }}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border bg-secondary/20 p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Score</p>
                  <p className="text-4xl font-black tracking-tight text-accent">{lastScore ?? 0}</p>
                </div>
                <div className="space-y-4 rounded-2xl border bg-secondary/20 p-4">
                  <MetricRow label="Hue" metric="hue" target={targetColor.h} guess={playerColor.h} targetColor={targetColor} guessColor={playerColor} />
                  <MetricRow label="Saturation" metric="saturation" target={targetColor.s} guess={playerColor.s} targetColor={targetColor} guessColor={playerColor} />
                  <MetricRow label="Lightness" metric="lightness" target={targetColor.l} guess={playerColor.l} targetColor={targetColor} guessColor={playerColor} />
                </div>
              </>
            )}
            {(showRankedSummaryOnly || lastScore != null) && (
              <Button className="w-full" onClick={beginPractice}>
                Continue playing (practice)
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
