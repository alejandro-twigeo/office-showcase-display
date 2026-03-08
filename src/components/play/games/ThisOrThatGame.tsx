import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore, todayDate, dateSeed, seededRandom } from '@/hooks/useMinigameScore';
import { useMinigameSettings } from '@/hooks/useMinigameSettings';
import { CheckCircle, X } from 'lucide-react';

const GAME_ID = 'this_or_that';

interface Question {
  prompt: string;
  a: string;
  b: string;
  correct: 'a' | 'b';
  category: string;
}

const QUESTION_POOL: Question[] = [
  { prompt: 'Which country has more people?', a: 'Indonesia', b: 'Brazil', correct: 'a', category: 'Geography' },
  { prompt: 'Which planet is larger?', a: 'Neptune', b: 'Uranus', correct: 'a', category: 'Space' },
  { prompt: 'Which city is further north?', a: 'London', b: 'Berlin', correct: 'a', category: 'Geography' },
  { prompt: 'Which element has a higher atomic number?', a: 'Gold (Au)', b: 'Silver (Ag)', correct: 'a', category: 'Science' },
  { prompt: 'Which river is longer?', a: 'Nile', b: 'Amazon', correct: 'a', category: 'Geography' },
  { prompt: 'Which animal lives longer on average?', a: 'Elephant', b: 'Horse', correct: 'a', category: 'Nature' },
  { prompt: 'Which country has more islands?', a: 'Sweden', b: 'Philippines', correct: 'a', category: 'Geography' },
  { prompt: 'Which ocean is deeper?', a: 'Pacific', b: 'Atlantic', correct: 'a', category: 'Geography' },
  { prompt: 'Which was invented first?', a: 'Telephone', b: 'Light bulb', correct: 'a', category: 'History' },
  { prompt: 'Which building is taller?', a: 'Burj Khalifa', b: 'Shanghai Tower', correct: 'a', category: 'Architecture' },
  { prompt: 'Which language has more native speakers?', a: 'Spanish', b: 'English', correct: 'a', category: 'Language' },
  { prompt: 'Which metal is heavier per cm³?', a: 'Lead', b: 'Iron', correct: 'a', category: 'Science' },
  { prompt: 'Which country is larger by area?', a: 'Australia', b: 'India', correct: 'a', category: 'Geography' },
  { prompt: 'Which mountain is taller?', a: 'K2', b: 'Kangchenjunga', correct: 'a', category: 'Geography' },
  { prompt: 'Which fruit has more vitamin C per 100g?', a: 'Kiwi', b: 'Orange', correct: 'a', category: 'Food' },
  { prompt: 'Which came first?', a: 'Roman Empire fall', b: 'Viking Age', correct: 'a', category: 'History' },
  { prompt: 'Which planet has more moons?', a: 'Saturn', b: 'Jupiter', correct: 'a', category: 'Space' },
  { prompt: 'Which desert is larger?', a: 'Sahara', b: 'Arabian', correct: 'a', category: 'Geography' },
  { prompt: 'Which has a higher boiling point?', a: 'Water', b: 'Ethanol', correct: 'a', category: 'Science' },
  { prompt: 'Which city is older?', a: 'Athens', b: 'Rome', correct: 'a', category: 'History' },
  { prompt: 'Which animal is faster?', a: 'Cheetah', b: 'Pronghorn', correct: 'a', category: 'Nature' },
  { prompt: 'Which country produces more coffee?', a: 'Brazil', b: 'Vietnam', correct: 'a', category: 'Food' },
  { prompt: 'Which lake is deeper?', a: 'Lake Baikal', b: 'Lake Tanganyika', correct: 'a', category: 'Geography' },
  { prompt: 'Which bone is longer?', a: 'Femur', b: 'Tibia', correct: 'a', category: 'Science' },
  { prompt: 'Who was born first?', a: 'Mozart', b: 'Beethoven', correct: 'a', category: 'History' },
  { prompt: 'Which is further from the Sun?', a: 'Mars', b: 'Venus', correct: 'a', category: 'Space' },
  { prompt: 'Which has more calories per 100g?', a: 'Avocado', b: 'Banana', correct: 'a', category: 'Food' },
  { prompt: 'Which runs at a higher voltage?', a: 'European power outlets (230V)', b: 'US power outlets (120V)', correct: 'a', category: 'Tech' },
  { prompt: 'Which country won more FIFA World Cups?', a: 'Brazil', b: 'Germany', correct: 'a', category: 'Sport' },
  { prompt: 'Which star is closer to Earth?', a: 'Proxima Centauri', b: 'Sirius', correct: 'a', category: 'Space' },
];

function generateDailyQuestions(dateStr: string): Question[] {
  const seed = dateSeed(dateStr);
  const rng = seededRandom(seed);

  const shuffled = [...QUESTION_POOL].sort(() => rng() - 0.5);
  // For each question, randomly swap a/b so the correct answer isn't always 'a'
  return shuffled.slice(0, 5).map(q => {
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

  const questions = useMemo(() => generateDailyQuestions(todayDate()), []);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<{ choice: 'a' | 'b'; correct: boolean }[]>([]);
  const [showResult, setShowResult] = useState<{ correct: boolean; correctAnswer: string } | null>(null);
  const [done, setDone] = useState(false);

  const handleAnswer = async (choice: 'a' | 'b') => {
    const q = questions[currentQ];
    const isCorrect = choice === q.correct;
    const correctAnswer = q.correct === 'a' ? q.a : q.b;

    const newAnswers = [...answers, { choice, correct: isCorrect }];
    setAnswers(newAnswers);
    setShowResult({ correct: isCorrect, correctAnswer });

    // Brief delay to show result
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

  const q = questions[currentQ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">⚖️ This or That</CardTitle>
        <p className="text-xs text-muted-foreground">Question {currentQ + 1} of 5 · {q.category}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium text-center py-2">{q.prompt}</p>

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
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-20 text-base font-semibold whitespace-normal"
              onClick={() => handleAnswer('a')}
            >
              {q.a}
            </Button>
            <Button
              variant="outline"
              className="h-20 text-base font-semibold whitespace-normal"
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
