import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore, todayDate, dateSeed, seededRandom } from '@/hooks/useMinigameScore';
import { useMinigameSettings } from '@/hooks/useMinigameSettings';
import { CheckCircle } from 'lucide-react';

const GAME_ID = 'this_or_that';

interface Question {
  a: string;
  b: string;
  category: string;
}

// Generate daily questions from seed
function generateDailyQuestions(dateStr: string): Question[] {
  const seed = dateSeed(dateStr);
  const rng = seededRandom(seed);

  const pool: Question[] = [
    { a: 'Coffee', b: 'Tea', category: 'Drinks' },
    { a: 'Morning person', b: 'Night owl', category: 'Lifestyle' },
    { a: 'Beach vacation', b: 'Mountain trip', category: 'Travel' },
    { a: 'Cats', b: 'Dogs', category: 'Pets' },
    { a: 'Books', b: 'Movies', category: 'Entertainment' },
    { a: 'Summer', b: 'Winter', category: 'Seasons' },
    { a: 'Sweet', b: 'Savory', category: 'Food' },
    { a: 'City life', b: 'Country life', category: 'Lifestyle' },
    { a: 'Early bird', b: 'Last minute', category: 'Work style' },
    { a: 'Phone call', b: 'Text message', category: 'Communication' },
    { a: 'Cooking at home', b: 'Eating out', category: 'Food' },
    { a: 'Spotify', b: 'YouTube Music', category: 'Music' },
    { a: 'Window seat', b: 'Aisle seat', category: 'Travel' },
    { a: 'Dark mode', b: 'Light mode', category: 'Tech' },
    { a: 'Introvert', b: 'Extrovert', category: 'Personality' },
    { a: 'Pizza', b: 'Sushi', category: 'Food' },
    { a: 'Netflix', b: 'Cinema', category: 'Entertainment' },
    { a: 'Rain', b: 'Sunshine', category: 'Weather' },
    { a: 'Running', b: 'Swimming', category: 'Sport' },
    { a: 'Board games', b: 'Video games', category: 'Games' },
  ];

  // Shuffle and pick 5
  const shuffled = [...pool].sort(() => rng() - 0.5);
  return shuffled.slice(0, 5);
}

interface ThisOrThatGameProps {
  playerName: string;
}

export function ThisOrThatGame({ playerName }: ThisOrThatGameProps) {
  const deviceId = useDeviceId();
  const settings = useMinigameSettings();
  const { data: todayScore } = useMinigameTodayScore(GAME_ID, playerName);
  const submitScore = useSubmitMinigameScore();

  const questions = useMemo(() => generateDailyQuestions(todayDate()), []);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const handleAnswer = async (choice: string) => {
    const newAnswers = [...answers, choice];
    setAnswers(newAnswers);

    if (newAnswers.length >= 5) {
      // Calculate score
      const basePoints = 5 * settings.thisorthat_points_per_q;
      // Check streak from meta of previous days (simplified: just give base for now)
      const totalScore = basePoints;

      await submitScore.mutateAsync({
        game_id: GAME_ID,
        player_name: playerName,
        device_id: deviceId,
        score: totalScore,
        meta: { answers: newAnswers, questions_count: 5 },
      });
      setDone(true);
    } else {
      setCurrentQ(currentQ + 1);
    }
  };

  if (todayScore || done) {
    const score = todayScore?.score ?? (5 * settings.thisorthat_points_per_q);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">⚖️ This or That</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6 space-y-2">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
          <p className="font-medium">You scored {score} pts today!</p>
          <p className="text-xs text-muted-foreground">5/5 questions answered</p>
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
        <p className="text-sm font-medium text-center py-2">Which do you prefer?</p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-20 text-base font-semibold"
            onClick={() => handleAnswer(q.a)}
          >
            {q.a}
          </Button>
          <Button
            variant="outline"
            className="h-20 text-base font-semibold"
            onClick={() => handleAnswer(q.b)}
          >
            {q.b}
          </Button>
        </div>
        <div className="flex gap-1 justify-center">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i < answers.length ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
