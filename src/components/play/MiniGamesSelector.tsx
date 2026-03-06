import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WordleGame } from './WordleGame';
import { Gamepad2 } from 'lucide-react';

interface MiniGame {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

const MINI_GAMES: MiniGame[] = [
  { id: 'wordle', name: 'Wordle', emoji: '🟩', description: 'Guess the 5-letter word' },
  // Add more games here in the future
];

interface MiniGamesSelectorProps {
  playerName: string;
}

export function MiniGamesSelector({ playerName }: MiniGamesSelectorProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  if (selectedGame === 'wordle') {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedGame(null)}
          className="text-muted-foreground"
        >
          ← Back to games
        </Button>
        <WordleGame playerName={playerName} />
        <WordleLeaderboard />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-primary" />
          Mini Games
        </CardTitle>
        <p className="text-xs text-muted-foreground">Pick a game to play</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {MINI_GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(game.id)}
              className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/30 hover:bg-secondary/60 transition-colors text-left"
            >
              <span className="text-2xl">{game.emoji}</span>
              <div>
                <p className="font-medium text-sm">{game.name}</p>
                <p className="text-xs text-muted-foreground">{game.description}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
