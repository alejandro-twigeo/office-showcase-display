import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore, todayDate, dateSeed, seededRandom } from '@/hooks/useMinigameScore';
import { useMinigameSettings } from '@/hooks/useMinigameSettings';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, X, Loader2 } from 'lucide-react';

const GAME_ID = 'this_or_that';

interface Question {
  prompt: string;
  a: string;
  b: string;
  correct: 'a' | 'b';
  category: string;
}

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

export function ThisOrThatGame({ playerName, roundId }: ThisOrThatGameProps) {
  const deviceId = useDeviceId();
  const settings = useMinigameSettings();
  const { data: todayScore } = useMinigameTodayScore(GAME_ID, playerName, roundId);
  const submitScore = useSubmitMinigameScore();

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<{ choice: 'a' | 'b'; correct: boolean }[]>([]);
  const [showResult, setShowResult] = useState<{ correct: boolean; correctAnswer: string } | null>(null);
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

  const handleAnswer = async (choice: 'a' | 'b') => {
    if (!questions) return;
    const q = questions[currentQ];
    const isCorrect = choice === q.correct;
    const correctAnswer = q.correct === 'a' ? q.a : q.b;

    const newAnswers = [...answers, { choice, correct: isCorrect }];
    setAnswers(newAnswers);
    setShowResult({ correct: isCorrect, correctAnswer });

    setTimeout(async () => {
      setShowResult(null);
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
    }, 1500);
  };

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
        <p className="text-lg sm:text-base font-semibold text-center py-2 leading-snug">{q.prompt}</p>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-24 sm:h-20 text-lg sm:text-base font-semibold whitespace-normal"
              onClick={() => handleAnswer('a')}
            >
              {q.a}
            </Button>
            <Button
              variant="outline"
              className="h-24 sm:h-20 text-lg sm:text-base font-semibold whitespace-normal"
              onClick={() => handleAnswer('b')}
            >
              {q.b}
            </Button>
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
