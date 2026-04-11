import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getDeviceId, useDeviceId } from '@/hooks/useDeviceId';
import {
  useMinigameTodayScore,
  useSubmitMinigameScore,
  dateSeed,
  seededRandom,
  todayDate,
} from '@/hooks/useMinigameScore';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, Crosshair } from 'lucide-react';

const GAME_ID = 'color_memory';
const MEMORIZE_SECONDS = 5;
const MEMORIZE_TICKS = MEMORIZE_SECONDS * 100;

type Phase = 'memorize' | 'reconstruct' | 'result';
type Metric = 'hue' | 'saturation' | 'lightness';

interface HslColor {
  h: number;
  s: number;
  l: number;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface HsvColor {
  h: number;
  s: number;
  v: number;
}

interface LabColor {
  l: number;
  a: number;
  b: number;
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

function hslToRgb(color: HslColor): RgbColor {
  const h = ((color.h % 360) + 360) % 360 / 360;
  const s = clamp(color.s / 100, 0, 1);
  const l = clamp(color.l / 100, 0, 1);

  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const hueToRgb = (p: number, q: number, t: number) => {
    let adjusted = t;
    if (adjusted < 0) adjusted += 1;
    if (adjusted > 1) adjusted -= 1;
    if (adjusted < 1 / 6) return p + (q - p) * 6 * adjusted;
    if (adjusted < 1 / 2) return q;
    if (adjusted < 2 / 3) return p + (q - p) * (2 / 3 - adjusted) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

function rgbToHsv(color: RgbColor): HsvColor {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  return { h, s: s * 100, v: max * 100 };
}

function rgbToLab(color: RgbColor): LabColor {
  const srgbToLinear = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  const r = srgbToLinear(color.r);
  const g = srgbToLinear(color.g);
  const b = srgbToLinear(color.b);

  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) / 1.0;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

  const f = (value: number) => (
    value > 0.008856 ? value ** (1 / 3) : (7.787 * value) + 16 / 116
  );

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function deltaE2000(lab1: LabColor, lab2: LabColor) {
  const avgLp = (lab1.l + lab2.l) / 2;
  const c1 = Math.sqrt(lab1.a ** 2 + lab1.b ** 2);
  const c2 = Math.sqrt(lab2.a ** 2 + lab2.b ** 2);
  const avgC = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt((avgC ** 7) / (avgC ** 7 + 25 ** 7)));

  const a1Prime = (1 + g) * lab1.a;
  const a2Prime = (1 + g) * lab2.a;
  const c1Prime = Math.sqrt(a1Prime ** 2 + lab1.b ** 2);
  const c2Prime = Math.sqrt(a2Prime ** 2 + lab2.b ** 2);
  const avgCPrime = (c1Prime + c2Prime) / 2;

  const hPrime = (aPrime: number, b: number) => {
    if (aPrime === 0 && b === 0) return 0;
    const angle = Math.atan2(b, aPrime) * (180 / Math.PI);
    return angle >= 0 ? angle : angle + 360;
  };

  const h1Prime = hPrime(a1Prime, lab1.b);
  const h2Prime = hPrime(a2Prime, lab2.b);
  const deltaLPrime = lab2.l - lab1.l;
  const deltaCPrime = c2Prime - c1Prime;

  let deltaHPrime = 0;
  if (c1Prime !== 0 && c2Prime !== 0) {
    const diff = h2Prime - h1Prime;
    if (Math.abs(diff) <= 180) deltaHPrime = diff;
    else if (diff > 180) deltaHPrime = diff - 360;
    else deltaHPrime = diff + 360;
  }

  const deltaBigHPrime = 2 * Math.sqrt(c1Prime * c2Prime) * Math.sin((deltaHPrime / 2) * (Math.PI / 180));
  const avgLPrime = (lab1.l + lab2.l) / 2;

  let avgHPrime = h1Prime + h2Prime;
  if (c1Prime !== 0 && c2Prime !== 0) {
    const diff = Math.abs(h1Prime - h2Prime);
    if (diff <= 180) avgHPrime = (h1Prime + h2Prime) / 2;
    else if (h1Prime + h2Prime < 360) avgHPrime = (h1Prime + h2Prime + 360) / 2;
    else avgHPrime = (h1Prime + h2Prime - 360) / 2;
  }

  const t = 1
    - 0.17 * Math.cos((avgHPrime - 30) * (Math.PI / 180))
    + 0.24 * Math.cos((2 * avgHPrime) * (Math.PI / 180))
    + 0.32 * Math.cos((3 * avgHPrime + 6) * (Math.PI / 180))
    - 0.2 * Math.cos((4 * avgHPrime - 63) * (Math.PI / 180));

  const deltaTheta = 30 * Math.exp(-(((avgHPrime - 275) / 25) ** 2));
  const rC = 2 * Math.sqrt((avgCPrime ** 7) / (avgCPrime ** 7 + 25 ** 7));
  const sL = 1 + (0.015 * ((avgLPrime - 50) ** 2)) / Math.sqrt(20 + ((avgLPrime - 50) ** 2));
  const sC = 1 + 0.045 * avgCPrime;
  const sH = 1 + 0.015 * avgCPrime * t;
  const rT = -Math.sin(2 * deltaTheta * (Math.PI / 180)) * rC;

  return Math.sqrt(
    (deltaLPrime / sL) ** 2 +
    (deltaCPrime / sC) ** 2 +
    (deltaBigHPrime / sH) ** 2 +
    rT * (deltaCPrime / sC) * (deltaBigHPrime / sH)
  );
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
  const targetRgb = hslToRgb(target);
  const guessRgb = hslToRgb(guess);
  const targetHsv = rgbToHsv(targetRgb);
  const guessHsv = rgbToHsv(guessRgb);
  const targetLab = rgbToLab(targetRgb);
  const guessLab = rgbToLab(guessRgb);

  const dE = deltaE2000(targetLab, guessLab);
  const base = 10 / (1 + (dE / 25.25) ** 1.55);

  const hueDiff = Math.min(
    Math.abs(targetHsv.h - guessHsv.h),
    360 - Math.abs(targetHsv.h - guessHsv.h)
  );
  const avgSat = (targetHsv.s + guessHsv.s) / 2;

  const hueAccuracy = Math.max(0, 1 - (hueDiff / 25) ** 1.5);
  const satWeight = Math.min(1, avgSat / 30);
  const recovery = (10 - base) * hueAccuracy * satWeight * 0.25;

  const huePenFactor = Math.max(0, (hueDiff - 30) / 150);
  const satWeightPenalty = Math.min(1, avgSat / 40);
  const penalty = base * huePenFactor * satWeightPenalty * 0.15;

  return clamp(Math.round((base + recovery - penalty) * 1000) / 100, 0, 100);
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

function sliderBackground(metric: Metric, color: HslColor) {
  if (metric === 'hue') {
    return 'linear-gradient(180deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 45%), hsl(180 100% 45%), hsl(240 100% 60%), hsl(300 100% 55%), hsl(360 100% 50%))';
  }
  if (metric === 'saturation') {
    return `linear-gradient(180deg, hsl(${Math.round(color.h)} 100% ${Math.round(color.l)}%), hsl(${Math.round(color.h)} 0% ${Math.round(color.l)}%))`;
  }
  return `linear-gradient(180deg, hsl(${Math.round(color.h)} ${Math.round(color.s)}% 82%), hsl(${Math.round(color.h)} ${Math.round(color.s)}% 12%))`;
}

function sliderBackgroundHorizontal(metric: Metric, color: HslColor) {
  if (metric === 'hue') {
    return 'linear-gradient(90deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 45%), hsl(180 100% 45%), hsl(240 100% 60%), hsl(300 100% 55%), hsl(360 100% 50%))';
  }
  if (metric === 'saturation') {
    return `linear-gradient(90deg, hsl(${Math.round(color.h)} 0% ${Math.round(color.l)}%), hsl(${Math.round(color.h)} 100% ${Math.round(color.l)}%))`;
  }
  return `linear-gradient(90deg, hsl(${Math.round(color.h)} ${Math.round(color.s)}% 12%), hsl(${Math.round(color.h)} ${Math.round(color.s)}% 82%))`;
}

function metricLabel(metric: Metric) {
  if (metric === 'hue') return 'Hue';
  if (metric === 'saturation') return 'Saturation';
  return 'Lightness';
}

function CountdownDisplay({ value }: { value: number }) {
  const padded = String(value).padStart(3, '0');
  const hundreds = padded.slice(0, 1);
  const remainder = padded.slice(1);

  return (
    <p className="dialed-counter text-[clamp(2.8rem,7vw,4.2rem)] font-black leading-none tracking-[-0.08em]">
      <span className="text-white">{hundreds}</span>
      <span className="text-white/72">{remainder}</span>
    </p>
  );
}

function metricTrackColor(metric: Metric, color: HslColor, value: number) {
  if (metric === 'hue') {
    return { h: value, s: 100, l: 50 };
  }
  if (metric === 'saturation') {
    return { ...color, s: value };
  }
  return { ...color, l: value };
}

function MetricComparison({
  metric,
  targetColor,
  guessColor,
}: {
  metric: Metric;
  targetColor: HslColor;
  guessColor: HslColor;
}) {
  const targetValue = metric === 'hue' ? targetColor.h : metric === 'saturation' ? targetColor.s : targetColor.l;
  const guessValue = metric === 'hue' ? guessColor.h : metric === 'saturation' ? guessColor.s : guessColor.l;
  const max = metric === 'hue' ? 359 : 100;
  const targetPosition = (targetValue / max) * 100;
  const guessPosition = (guessValue / max) * 100;

  return (
    <div className="space-y-3 rounded-[1.2rem] bg-muted p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{metricLabel(metric)}</p>
      <div className="space-y-3">
        <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Target</p>
          <div
            className="relative h-4 rounded-full border"
            style={{
              background: sliderBackgroundHorizontal(metric, metricTrackColor(metric, targetColor, targetValue)),
            }}
          >
            <div
              className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-[0_4px_14px_rgba(15,23,42,0.18)]"
              style={{ left: `${targetPosition}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Guess</p>
          <div
            className="relative h-4 rounded-full border"
            style={{
              background: sliderBackgroundHorizontal(metric, metricTrackColor(metric, guessColor, guessValue)),
            }}
          >
            <div
              className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-[0_4px_14px_rgba(15,23,42,0.18)]"
              style={{ left: `${guessPosition}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function VerticalSlider({
  metric,
  value,
  color,
  onChange,
}: {
  metric: Metric;
  value: number;
  color: HslColor;
  onChange: (value: number) => void;
}) {
  const max = metric === 'hue' ? 359 : 100;
  const ratio = metric === 'hue' ? value / max : 1 - value / max;

  const setFromPointer = (clientY: number, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    const rawRatio = clamp((clientY - rect.top) / rect.height, 0, 1);
    const nextValue = metric === 'hue'
      ? Math.round(rawRatio * max)
      : Math.round((1 - rawRatio) * max);
    onChange(nextValue);
  };

  return (
    <div
      className="dialed-rail"
      onPointerDown={(event) => {
        const rail = event.currentTarget;
        rail.setPointerCapture(event.pointerId);
        setFromPointer(event.clientY, rail);
      }}
      onPointerMove={(event) => {
        if ((event.buttons & 1) !== 1) return;
        setFromPointer(event.clientY, event.currentTarget);
      }}
    >
      <div className="dialed-rail-label">
        <span>{metric === 'hue' ? 'Hue' : metric === 'saturation' ? 'Saturation' : 'Lightness'}</span>
      </div>
      <div
        className="dialed-vertical-track"
        style={{ background: sliderBackground(metric, color) }}
      />
      <div
        className="dialed-vertical-thumb"
        style={{ top: `calc(${ratio * 100}% - 0.625rem)` }}
      />
    </div>
  );
}

function Board({
  color,
  phase,
  secondsLeft,
  countdownTicks,
  playerColor,
  onChangeMetric,
  onPrimaryAction,
}: {
  color: HslColor;
  phase: Phase;
  secondsLeft: number;
  countdownTicks: number;
  playerColor: HslColor;
  onChangeMetric: (metric: Metric, value: number) => void;
  onPrimaryAction: () => void;
}) {
  const showSliders = phase === 'reconstruct';
  const boardColor = phase === 'memorize' ? color : playerColor;

  return (
    <div
      className="relative min-h-[clamp(15.5rem,38vw,23rem)] overflow-hidden rounded-[1.75rem] border border-black/10 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.12)]"
      style={{ backgroundColor: toCssHsl(boardColor) }}
    >
      {showSliders && (
        <div className="absolute inset-y-0 left-0 z-30 flex">
          <VerticalSlider
            metric="hue"
            value={playerColor.h}
            color={playerColor}
            onChange={(value) => onChangeMetric('hue', value)}
          />
          <VerticalSlider
            metric="saturation"
            value={playerColor.s}
            color={playerColor}
            onChange={(value) => onChangeMetric('saturation', value)}
          />
          <VerticalSlider
            metric="lightness"
            value={playerColor.l}
            color={playerColor}
            onChange={(value) => onChangeMetric('lightness', value)}
          />
        </div>
      )}

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_22%,rgba(0,0,0,0.02))]" />

      <div className="relative z-20 flex h-full min-h-[inherit] flex-col justify-between p-4 sm:p-5">
        <div className={`pointer-events-none max-w-sm text-white/88 ${showSliders ? 'pl-[8.5rem] sm:pl-[10rem]' : ''}`}>
          {phase === 'memorize' && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-white/72">Seconds to remember</p>
                <div className="mt-2">
                  <CountdownDisplay value={countdownTicks} />
                </div>
              </div>
            </div>
          )}
          {phase === 'result' && (
            <>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-white/72">Score</p>
              <p className="mt-2 text-base sm:text-lg">
                Compare your pick against the original across hue, saturation, and lightness.
              </p>
            </>
          )}
        </div>

        <div className="pointer-events-none flex items-end justify-end gap-4">
          {phase === 'memorize' && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="pointer-events-auto rounded-full bg-white/96 px-5 py-3 text-base font-semibold text-black shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
            >
              Start now
            </button>
          )}

          {phase === 'reconstruct' && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="pointer-events-auto grid h-20 w-20 place-items-center rounded-full bg-white/96 text-black shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-transform hover:scale-[1.02]"
              aria-label="Submit guess"
            >
              <Crosshair className="h-8 w-8" />
            </button>
          )}
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
  const [countdownTicks, setCountdownTicks] = useState(MEMORIZE_TICKS);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [submittedRankedScore, setSubmittedRankedScore] = useState<number | null>(null);
  const [showRankedSummaryOnly, setShowRankedSummaryOnly] = useState(false);

  const startReconstruction = useCallback(() => {
    setPhase('reconstruct');
    setSecondsLeft(0);
    setCountdownTicks(0);
  }, []);

  const startRound = useCallback((target: HslColor, practiceMode: boolean) => {
    setTargetColor(target);
    setPlayerColor(createStartingGuess(target));
    setPhase('memorize');
    setSecondsLeft(MEMORIZE_SECONDS);
    setCountdownTicks(MEMORIZE_TICKS);
    setIsPracticeMode(practiceMode);
    setLastScore(null);
    setShowRankedSummaryOnly(false);
  }, []);

  useEffect(() => {
    setSubmittedRankedScore(null);
  }, [roundId]);

  useEffect(() => {
    if (submittedRankedScore != null) return;
    if (!todayScore) {
      return;
    }

    setIsPracticeMode(true);
    setPhase('result');
    setLastScore(todayScore.score);
    setTargetColor(rankedTarget);
    setPlayerColor(createStartingGuess(rankedTarget));
    setShowRankedSummaryOnly(true);
  }, [todayScore, rankedTarget, submittedRankedScore]);

  useEffect(() => {
    if (todayScore || submittedRankedScore != null) return;
    startRound(rankedTarget, false);
  }, [todayScore, rankedTarget, startRound, submittedRankedScore]);

  useEffect(() => {
    if (phase !== 'memorize') return;

    const startTime = performance.now();
    let frameId = 0;

    const update = (now: number) => {
      const elapsedMs = now - startTime;
      const remainingMs = Math.max(0, MEMORIZE_SECONDS * 1000 - elapsedMs);
      const nextTicks = Math.round((remainingMs / 1000) * 100);

      setCountdownTicks(nextTicks);
      setSecondsLeft(Math.ceil(remainingMs / 1000));

      if (remainingMs <= 0) {
        startReconstruction();
        return;
      }

      frameId = window.requestAnimationFrame(update);
    };

    frameId = window.requestAnimationFrame(update);

    return () => window.cancelAnimationFrame(frameId);
  }, [phase, startReconstruction]);

  const handleSubmit = async () => {
    const score = Math.round(scoreColorMatch(targetColor, playerColor));
    setLastScore(score);
    setPhase('result');
    setShowRankedSummaryOnly(false);

    if (!isPracticeMode && submittedRankedScore == null && !todayScore) {
      const stableDeviceId = deviceId || getDeviceId();
      setSubmittedRankedScore(score);

      try {
        await submitScore.mutateAsync({
          game_id: GAME_ID,
          player_name: playerName,
          device_id: stableDeviceId,
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
      } catch (error) {
        setSubmittedRankedScore(null);
        const description = error instanceof Error ? error.message : 'Could not save your score.';
        toast({
          title: 'Score not saved',
          description,
          variant: 'destructive',
        });
      }
    }
  };

  const beginPractice = () => {
    startRound(buildPracticeColor(), true);
  };

  const rankedSummary = todayScore ? (
    <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 text-center">
      <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700/80">Daily complete</p>
      <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-emerald-950">{todayScore.score}</p>
      <p className="mt-2 text-sm text-emerald-800/70">Ranked round already completed for this session.</p>
    </div>
  ) : null;

  return (
    <section className="space-y-5">
      <div className="rounded-[2rem] border bg-card p-5 shadow-sm sm:p-6">
        {(phase === 'memorize' || phase === 'reconstruct') && (
          <div className="mx-auto grid max-w-[66rem] items-start gap-4 lg:grid-cols-[minmax(0,52rem)_auto]">
            <Board
              color={targetColor}
              phase={phase}
              secondsLeft={secondsLeft}
              countdownTicks={countdownTicks}
              playerColor={playerColor}
              onChangeMetric={(metric, value) => {
                setPlayerColor((current) => {
                  if (metric === 'hue') return { ...current, h: value };
                  if (metric === 'saturation') return { ...current, s: value };
                  return { ...current, l: value };
                });
              }}
              onPrimaryAction={phase === 'memorize' ? startReconstruction : handleSubmit}
            />
            <div className="space-y-4">
              <div className="rounded-[1.25rem] bg-muted px-4 py-3 text-right">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Best today</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.06em] text-foreground">{todayScore?.score ?? submittedRankedScore ?? '--'}</p>
              </div>
              {phase === 'reconstruct' && (
                <div className="px-1 py-1">
                  <p className="text-sm leading-6 text-foreground">
                    use the rails to adjust
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {phase === 'result' && (
          <div className="space-y-4">
            {showRankedSummaryOnly ? rankedSummary : (
              <>
                <div className="mx-auto max-w-[68rem] space-y-4 rounded-[2rem] border bg-background p-4 sm:p-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_14rem]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Original</p>
                      <div
                        className="mt-3 h-20 rounded-[1.2rem] border sm:h-24"
                        style={{ backgroundColor: toCssHsl(targetColor) }}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Your selection</p>
                      <div
                        className="mt-3 h-20 rounded-[1.2rem] border sm:h-24"
                        style={{ backgroundColor: toCssHsl(playerColor) }}
                      />
                    </div>
                    <div className="rounded-[1.2rem] bg-muted p-4 text-center lg:self-end">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Score</p>
                      <p className="mt-2 text-4xl font-black tracking-[-0.08em] text-foreground sm:text-5xl">{lastScore ?? 0}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <MetricComparison metric="hue" targetColor={targetColor} guessColor={playerColor} />
                    <MetricComparison metric="saturation" targetColor={targetColor} guessColor={playerColor} />
                    <MetricComparison metric="lightness" targetColor={targetColor} guessColor={playerColor} />
                  </div>
                </div>
              </>
            )}

            {(showRankedSummaryOnly || lastScore != null) && (
              <Button className="w-full rounded-full" onClick={beginPractice}>
                Continue in practice
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
