import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore, todayDate, dateSeed, seededRandom } from '@/hooks/useMinigameScore';
import { useMinigameSettings } from '@/hooks/useMinigameSettings';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { CheckCircle, X, Loader2 } from 'lucide-react';

const GAME_ID = 'this_or_that';

interface Question {
  prompt: string;
  a: string;
  b: string;
  correct: 'a' | 'b';
  category: string;
}

type AnswerChoice = 'a' | 'b';

const ANSWER_ANIMATION_MS = 420;
const RESULT_DISPLAY_MS = 1080;
const GOO_PARTICLES = [
  { x: '-16%', y: '8%', dx: '170%', dy: '38%', size: '15%', delay: 0, color: '#fdba74' },
  { x: '-14%', y: '34%', dx: '160%', dy: '18%', size: '13%', delay: 70, color: '#fb923c' },
  { x: '-17%', y: '66%', dx: '168%', dy: '-10%', size: '14%', delay: 120, color: '#fdba74' },
  { x: '-10%', y: '88%', dx: '136%', dy: '-44%', size: '12%', delay: 30, color: '#f97316' },
  { x: '18%', y: '-18%', dx: '28%', dy: '156%', size: '13%', delay: 90, color: '#fdba74' },
  { x: '44%', y: '-16%', dx: '4%', dy: '150%', size: '12%', delay: 20, color: '#fb7185' },
  { x: '72%', y: '-18%', dx: '-22%', dy: '158%', size: '14%', delay: 130, color: '#fb923c' },
  { x: '102%', y: '10%', dx: '-150%', dy: '34%', size: '15%', delay: 40, color: '#fb7185' },
  { x: '104%', y: '38%', dx: '-162%', dy: '12%', size: '13%', delay: 100, color: '#fdba74' },
  { x: '101%', y: '68%', dx: '-154%', dy: '-14%', size: '14%', delay: 10, color: '#f97316' },
  { x: '90%', y: '96%', dx: '-106%', dy: '-74%', size: '12%', delay: 150, color: '#fb7185' },
  { x: '62%', y: '108%', dx: '-32%', dy: '-114%', size: '13%', delay: 60, color: '#fdba74' },
  { x: '34%', y: '110%', dx: '10%', dy: '-122%', size: '14%', delay: 0, color: '#fb923c' },
  { x: '8%', y: '104%', dx: '52%', dy: '-94%', size: '12%', delay: 110, color: '#fdba74' },
  { x: '-8%', y: '94%', dx: '120%', dy: '-64%', size: '13%', delay: 50, color: '#f97316' },
] as const;

// Fallback pool in case AI generation fails
const FALLBACK_QUESTIONS: Question[] = [
  { prompt: 'Which country has more people?', a: 'Indonesia', b: 'Brazil', correct: 'a', category: 'Geography' },
  { prompt: 'Which planet is larger?', a: 'Neptune', b: 'Uranus', correct: 'a', category: 'Space' },
  { prompt: 'Which city is further north?', a: 'London', b: 'Berlin', correct: 'a', category: 'Geography' },
  { prompt: 'Which river is longer?', a: 'Nile', b: 'Amazon', correct: 'a', category: 'Geography' },
  { prompt: 'Which animal lives longer on average?', a: 'Elephant', b: 'Horse', correct: 'a', category: 'Nature' },
  { prompt: 'Which ocean is deeper?', a: 'Pacific', b: 'Atlantic', correct: 'a', category: 'Geography' },
  { prompt: 'Which was invented first?', a: 'Telephone', b: 'Light bulb', correct: 'a', category: 'History' },
  { prompt: 'Which building is taller?', a: 'Burj Khalifa', b: 'Shanghai Tower', correct: 'a', category: 'Architecture' },
  { prompt: 'Which language has more native speakers?', a: 'Spanish', b: 'English', correct: 'a', category: 'Language' },
  { prompt: 'Which country is larger by area?', a: 'Australia', b: 'India', correct: 'a', category: 'Geography' },
];

function pickFallbackQuestions(): Question[] {
  const seed = dateSeed(todayDate());
  const rng = seededRandom(seed);
  const shuffled = [...FALLBACK_QUESTIONS].sort(() => rng() - 0.5);
  return shuffled.slice(0, 5).map(q => {
    if (rng() > 0.5) {
      return { ...q, a: q.b, b: q.a, correct: (q.correct === 'a' ? 'b' : 'a') as 'a' | 'b' };
    }
    return q;
  });
}

function swapAnswerPositions(questions: Question[]): Question[] {
  const seed = dateSeed(todayDate());
  const rng = seededRandom(seed);
  return questions.map(q => {
    if (rng() > 0.5) {
      return { ...q, a: q.b, b: q.a, correct: (q.correct === 'a' ? 'b' : 'a') as 'a' | 'b' };
    }
    return q;
  });
}

interface ThisOrThatGameProps {
  playerName: string;
  roundId?: string;
}

function ThisOrThatAnswerButton({
  label,
  onClick,
  isSelected,
  isDimmed,
  isLocked,
  isMobile,
}: {
  label: string;
  onClick: () => void;
  isSelected: boolean;
  isDimmed: boolean;
  isLocked: boolean;
  isMobile: boolean;
}) {
  return (
    <div
      className={[
        'group relative overflow-visible',
        isMobile ? 'h-24' : 'h-20',
        isDimmed ? 'opacity-55' : 'opacity-100',
      ].join(' ')}
    >
      {isSelected && (
        <>
          <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true">
            <defs>
              <filter id="this-or-that-goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
                <feColorMatrix
                  in="blur"
                  mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
                  result="goo"
                />
                <feBlend in="SourceGraphic" in2="goo" />
              </filter>
            </defs>
          </svg>
          <div className="pointer-events-none absolute inset-0 z-0" style={{ filter: 'url(#this-or-that-goo)' }}>
            {GOO_PARTICLES.map((particle, index) => {
              return (
                <div
                  key={`goo-particle-${index}`}
                  className="absolute rounded-full animate-[gooey-particle-ring_640ms_cubic-bezier(0.22,1,0.36,1)_both]"
                  style={{
                    left: particle.x,
                    top: particle.y,
                    width: particle.size,
                    height: particle.size,
                    backgroundColor: particle.color,
                    animationDelay: `${particle.delay}ms`,
                    animationDuration: `${ANSWER_ANIMATION_MS + 220}ms`,
                    ['--goo-dx' as string]: particle.dx,
                    ['--goo-dy' as string]: particle.dy,
                  }}
                />
              );
            })}
            <div className="absolute inset-[12%] animate-[gooey-core_520ms_cubic-bezier(0.22,1,0.36,1)_both] rounded-[1.25rem] bg-[linear-gradient(135deg,#fdba74,#f97316_48%,#ef4444)] opacity-92" />
          </div>
        </>
      )}

      <Button
        variant="outline"
        className={[
          'relative z-10 h-full w-full overflow-hidden rounded-[1.4rem] border-0 bg-transparent p-0 shadow-none hover:bg-transparent',
        ].join(' ')}
        disabled={isLocked}
        onClick={onClick}
      >
        <div className="absolute inset-0 rounded-[1.4rem] bg-gradient-to-br from-slate-100 via-white to-orange-50 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" />
        <div className="absolute inset-0 rounded-[1.4rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),transparent_55%)] opacity-80" />
        {isSelected && (
          <div className="absolute inset-[6%] rounded-[1.2rem] bg-[linear-gradient(135deg,#fdba74,#f97316_48%,#ef4444)] opacity-90" />
        )}
        <div
          className={[
            'relative z-10 flex h-full w-full items-center justify-center rounded-[1.4rem] px-4 text-center font-semibold whitespace-normal transition-all duration-300',
          isMobile ? 'text-lg' : 'text-base',
          isSelected ? 'scale-[0.985] text-white' : 'text-slate-800',
        ].join(' ')}
        >
          {label}
        </div>
      </Button>
    </div>
  );
}

export function ThisOrThatGame({ playerName, roundId }: ThisOrThatGameProps) {
  const isMobile = useIsMobile();
  const deviceId = useDeviceId();
  const settings = useMinigameSettings();
  const { data: todayScore } = useMinigameTodayScore(GAME_ID, playerName, roundId);
  const submitScore = useSubmitMinigameScore();

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<{ choice: 'a' | 'b'; correct: boolean }[]>([]);
  const [showResult, setShowResult] = useState<{ correct: boolean; correctAnswer: string } | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<AnswerChoice | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchQuestions() {
      try {
        const today = todayDate();

        // Try fetching from DB first
        const { data: cached } = await supabase
          .from('daily_thisorthat')
          .select('questions')
          .eq('run_date', today)
          .single();

        if (cached?.questions && (cached.questions as unknown as any[]).length >= 5) {
          if (!cancelled) {
            setQuestions(swapAnswerPositions(cached.questions as unknown as Question[]));
            setLoading(false);
          }
          return;
        }

        // Generate via edge function
        const { data: fnData, error: fnError } = await supabase.functions.invoke('generate-thisorthat');

        if (fnError) throw fnError;

        if (fnData?.questions && fnData.questions.length >= 5) {
          if (!cancelled) {
            setQuestions(swapAnswerPositions(fnData.questions as Question[]));
            setLoading(false);
          }
          return;
        }

        throw new Error('No questions returned');
      } catch (err) {
        console.error('Failed to fetch This or That questions, using fallback:', err);
        if (!cancelled) {
          setQuestions(pickFallbackQuestions());
          setLoading(false);
        }
      }
    }

    fetchQuestions();
    return () => { cancelled = true; };
  }, []);

  const handleAnswer = useCallback(async (choice: AnswerChoice) => {
    if (!questions || selectedChoice || showResult) return;
    const q = questions[currentQ];
    const isCorrect = choice === q.correct;
    const correctAnswer = q.correct === 'a' ? q.a : q.b;

    const newAnswers = [...answers, { choice, correct: isCorrect }];
    setSelectedChoice(choice);

    window.setTimeout(() => {
      setAnswers(newAnswers);
      setShowResult({ correct: isCorrect, correctAnswer });
    }, ANSWER_ANIMATION_MS);

    window.setTimeout(async () => {
      setShowResult(null);
      setSelectedChoice(null);
      if (newAnswers.length >= 5) {
        const correctCount = newAnswers.filter(a => a.correct).length;
        const totalScore = correctCount * settings.thisorthat_points_per_q;

        await submitScore.mutateAsync({
          game_id: GAME_ID,
          player_name: playerName,
          device_id: deviceId,
          score: totalScore,
          round_id: roundId,
          meta: { correct: correctCount, total: 5 },
        });
        setDone(true);
      } else {
        setCurrentQ(currentQ + 1);
      }
    }, ANSWER_ANIMATION_MS + RESULT_DISPLAY_MS);
  }, [questions, selectedChoice, showResult, currentQ, answers, settings, submitScore, playerName, deviceId, roundId]);

  if (todayScore || done) {
    const score = todayScore?.score ?? 0;
    const correct = (todayScore?.meta as any)?.correct ?? answers.filter(a => a.correct).length;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">⚖️ This or That</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6 space-y-2">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
          <p className="font-medium">You scored {score} pts today!</p>
          <p className="text-xs text-muted-foreground">{correct}/5 correct answers</p>
        </CardContent>
      </Card>
    );
  }

  if (loading || !questions) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">⚖️ This or That</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Generating today's questions...</span>
        </CardContent>
      </Card>
    );
  }

  const q = questions[currentQ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">⚖️ This or That</CardTitle>
        <p className="text-xs text-muted-foreground">Question {currentQ + 1} of 5 · {q.category}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <style>{`
          @keyframes gooey-core {
            0% { transform: scale(0.72); opacity: 0.72; }
            55% { transform: scale(1.06); opacity: 1; }
            100% { transform: scale(1); opacity: 0.95; }
          }

          @keyframes gooey-particle-ring {
            0% { transform: translate(0, 0) scale(0.68); opacity: 0; }
            30% { opacity: 1; }
            68% { transform: translate(var(--goo-dx), var(--goo-dy)) scale(1.08); opacity: 0.96; }
            100% { transform: translate(calc(var(--goo-dx) * 0.82), calc(var(--goo-dy) * 0.82)) scale(0.9); opacity: 0.84; }
          }
        `}</style>
        <p className={isMobile ? 'text-lg font-semibold text-center py-2 leading-snug' : 'text-base font-semibold text-center py-2 leading-snug'}>{q.prompt}</p>

        {showResult ? (
          <div className={`text-center py-4 rounded-lg border-2 ${showResult.correct ? 'border-green-500 bg-green-500/10' : 'border-destructive bg-destructive/10'}`}>
            {showResult.correct ? (
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-1" />
            ) : (
              <X className="h-8 w-8 text-destructive mx-auto mb-1" />
            )}
            <p className="text-sm font-medium">{showResult.correct ? 'Correct!' : 'Wrong!'}</p>
            {!showResult.correct && (
              <p className="text-xs text-muted-foreground mt-1">Answer: {showResult.correctAnswer}</p>
            )}
          </div>
        ) : (
          <div className={isMobile ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
            <ThisOrThatAnswerButton
              label={q.a}
              onClick={() => handleAnswer('a')}
              isSelected={selectedChoice === 'a'}
              isDimmed={selectedChoice === 'b'}
              isLocked={selectedChoice !== null}
              isMobile={isMobile}
            />
            <ThisOrThatAnswerButton
              label={q.b}
              onClick={() => handleAnswer('b')}
              isSelected={selectedChoice === 'b'}
              isDimmed={selectedChoice === 'a'}
              isLocked={selectedChoice !== null}
              isMobile={isMobile}
            />
          </div>
        )}

        <div className="flex gap-1 justify-center">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${
              i < answers.length
                ? answers[i].correct ? 'bg-green-500' : 'bg-destructive'
                : i === currentQ ? 'bg-primary' : 'bg-muted'
            }`} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
