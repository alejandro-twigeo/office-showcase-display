import { useState, useImperativeHandle, forwardRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { WordleGame } from './WordleGame';
import { CityGuessGame } from './games/CityGuessGame';
import { ColorMemoryGame } from './games/ColorMemoryGame';
import { ThisOrThatGame } from './games/ThisOrThatGame';
import { SudokuGame } from './games/SudokuGame';
import { PairsGame } from './games/PairsGame';
import { LabyrinthGame } from './games/LabyrinthGame';
import { MiniGamesLeaderboardGrid } from './MiniGamesLeaderboardGrid';
import { MINI_GAMES } from './miniGamesList';
export { MINI_GAMES };

import { useGameIcons } from '@/hooks/useGameIcons';

interface MiniGamesSelectorProps {
  playerName: string;
  onGameChange?: (gameId: string | null) => void;
  roundId?: string;
  includeGeoGuessr?: boolean;
  onSelectGeoGuessr?: () => void;
}

export interface MiniGamesSelectorHandle {
  reset: () => void;
}

export const MiniGamesSelector = forwardRef<MiniGamesSelectorHandle, MiniGamesSelectorProps>(
  function MiniGamesSelector({ playerName, onGameChange, roundId, includeGeoGuessr = false, onSelectGeoGuessr }, ref) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const { icons } = useGameIcons();

  useImperativeHandle(ref, () => ({
    reset: () => { setSelectedGame(null); onGameChange?.(null); },
  }));

  const selectGame = (id: string | null) => {
    setSelectedGame(id);
    onGameChange?.(id);
  };

  if (selectedGame) {
    return (
      <div className="space-y-4">
        {selectedGame === 'wordle' && <WordleGame playerName={playerName} roundId={roundId} />}
        {selectedGame === 'city_guess' && <CityGuessGame playerName={playerName} roundId={roundId} />}
        {selectedGame === 'color_memory' && <ColorMemoryGame playerName={playerName} roundId={roundId} />}
        {selectedGame === 'this_or_that' && <ThisOrThatGame playerName={playerName} roundId={roundId} />}
        {selectedGame === 'sudoku' && <SudokuGame playerName={playerName} roundId={roundId} />}
        {selectedGame === 'pairs' && <PairsGame playerName={playerName} roundId={roundId} />}
        {selectedGame === 'labyrinth' && <LabyrinthGame playerName={playerName} roundId={roundId} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {includeGeoGuessr && (
              <button
                onClick={onSelectGeoGuessr}
                className="flex flex-col items-center justify-center gap-2 p-2 rounded-xl border bg-secondary/30 hover:bg-secondary/60 hover:scale-105 transition-all text-center sm:min-h-[8.75rem]"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-background/50 sm:w-[4.1rem] sm:h-[4.1rem] sm:rounded-[1.1rem] sm:bg-gradient-to-br sm:from-white sm:to-slate-100 sm:shadow-[0_10px_24px_rgba(15,23,42,0.12)] sm:ring-1 sm:ring-slate-200/80">
                  {icons['geoguessr'] ? (
                    <img src={icons['geoguessr']} alt="GeoGuessr" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl sm:text-[2rem]">🎯</span>
                  )}
                </div>
                <p className="font-medium text-[10px] leading-tight sm:text-xs">GeoGuessr</p>
              </button>
            )}
            {MINI_GAMES.map((game) => (
              <button
                key={game.id}
                onClick={() => selectGame(game.id)}
                className="flex flex-col items-center justify-center gap-2 p-2 rounded-xl border bg-secondary/30 hover:bg-secondary/60 hover:scale-105 transition-all text-center sm:min-h-[8.75rem]"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-background/50 sm:w-[4.1rem] sm:h-[4.1rem] sm:rounded-[1.1rem] sm:bg-gradient-to-br sm:from-white sm:to-slate-100 sm:shadow-[0_10px_24px_rgba(15,23,42,0.12)] sm:ring-1 sm:ring-slate-200/80">
                  {icons[game.id] ? (
                    <img src={icons[game.id]} alt={game.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl sm:text-[2rem]">{game.emoji}</span>
                  )}
                </div>
                <p className="font-medium text-[10px] leading-tight sm:text-xs">{game.name}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <MiniGamesLeaderboardGrid />
    </div>
  );
});
