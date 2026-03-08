import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WordleGame } from './WordleGame';
import { CityGuessGame } from './games/CityGuessGame';
import { ThisOrThatGame } from './games/ThisOrThatGame';
import { SudokuGame } from './games/SudokuGame';
import { PairsGame } from './games/PairsGame';
import { LabyrinthGame } from './games/LabyrinthGame';
import { MinigameLeaderboard } from './MinigameLeaderboard';
import { Gamepad2 } from 'lucide-react';
import { useGameIcons } from '@/hooks/useGameIcons';

interface MiniGame {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

const MINI_GAMES: MiniGame[] = [
  { id: 'wordle', name: 'Wordle', emoji: '🟩', description: 'Guess the 5-letter word' },
  { id: 'city_guess', name: 'City Guess', emoji: '🏙️', description: 'Guess location in a specific city' },
  { id: 'this_or_that', name: 'This or That', emoji: '⚖️', description: '5 daily preference questions' },
  { id: 'sudoku', name: 'Sudoku', emoji: '🔢', description: '6×6 sudoku, hard mode' },
  { id: 'pairs', name: 'Pairs', emoji: '🃏', description: 'Memory card matching game' },
  { id: 'labyrinth', name: 'Labyrinth', emoji: '🌀', description: 'Escape the daily maze' },
];

interface MiniGamesSelectorProps {
  playerName: string;
  onGameChange?: (gameId: string | null) => void;
}

export function MiniGamesSelector({ playerName, onGameChange }: MiniGamesSelectorProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const { icons } = useGameIcons();

  const selectGame = (id: string | null) => {
    setSelectedGame(id);
    onGameChange?.(id);
  };

  if (selectedGame) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => selectGame(null)}
          className="text-muted-foreground"
        >
          ← Back to games
        </Button>
        {selectedGame === 'wordle' && <WordleGame playerName={playerName} />}
        {selectedGame === 'city_guess' && <CityGuessGame playerName={playerName} />}
        {selectedGame === 'this_or_that' && <ThisOrThatGame playerName={playerName} />}
        {selectedGame === 'sudoku' && <SudokuGame playerName={playerName} />}
        {selectedGame === 'pairs' && <PairsGame playerName={playerName} />}
        {selectedGame === 'labyrinth' && <LabyrinthGame playerName={playerName} />}

        {selectedGame !== 'wordle' && (
          <MinigameLeaderboard
            gameId={selectedGame}
            title={MINI_GAMES.find(g => g.id === selectedGame)?.name ?? ''}
            emoji={MINI_GAMES.find(g => g.id === selectedGame)?.emoji}
            formatMeta={(meta) => {
              if (meta.time_seconds != null) return `${Math.floor(meta.time_seconds / 60)}:${String(meta.time_seconds % 60).padStart(2, '0')}`;
              if (meta.moves != null) return `${meta.moves} moves`;
              if (meta.attempts != null) return `${meta.attempts} attempts`;
              return '';
            }}
          />
        )}
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
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {MINI_GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => selectGame(game.id)}
              className="flex flex-col items-center gap-1 p-2 rounded-xl border bg-secondary/30 hover:bg-secondary/60 hover:scale-105 transition-all text-center"
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-background/50">
                {icons[game.id] ? (
                  <img src={icons[game.id]} alt={game.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl">{game.emoji}</span>
                )}
              </div>
              <p className="font-medium text-[10px] leading-tight">{game.name}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
