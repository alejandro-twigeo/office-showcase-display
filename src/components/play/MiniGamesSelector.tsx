import { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { WordleGame } from './WordleGame';
import { CityGuessGame } from './games/CityGuessGame';
import { ColorMemoryGame } from './games/ColorMemoryGame';
import { ThisOrThatGame } from './games/ThisOrThatGame';
import { SudokuGame } from './games/SudokuGame';
import { PairsGame } from './games/PairsGame';
import { LabyrinthGame } from './games/LabyrinthGame';
import { RiddleGame } from './games/RiddleGame';
import riddleIcon from '@/assets/riddle-icon.svg';
import teamRiddleIcon from '@/assets/team-riddle-icon.svg';
import { TeamRiddleGame } from './games/TeamRiddleGame';
import { PlayHub } from './PlayHub';

/** Built-in icons for games that don't have one uploaded in Manager yet */
const LOCAL_ICONS: Record<string, string> = { riddle: riddleIcon, team_riddle: teamRiddleIcon };
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
  /** Open this game straight away (a link from the TV page) */
  initialGame?: string | null;
}

export interface MiniGamesSelectorHandle {
  reset: () => void;
}

export const MiniGamesSelector = forwardRef<MiniGamesSelectorHandle, MiniGamesSelectorProps>(
  function MiniGamesSelector({ playerName, onGameChange, roundId, includeGeoGuessr = false, onSelectGeoGuessr, initialGame = null }, ref) {
  const [selectedGame, setSelectedGame] = useState<string | null>(initialGame);
  // Tell the page a game is open when we start inside one
  useEffect(() => {
    if (initialGame) onGameChange?.(initialGame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
        {selectedGame === 'riddle' && <RiddleGame playerName={playerName} roundId={roundId} />}
        {selectedGame === 'team_riddle' && <TeamRiddleGame playerName={playerName} roundId={roundId} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PlayHub
        playerName={playerName}
        roundId={roundId}
        onOpenGame={(id) => (id === 'geo' ? onSelectGeoGuessr?.() : selectGame(id))}
      />
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-2.5">
            {includeGeoGuessr && (
              <button
                onClick={onSelectGeoGuessr}
                className="min-w-0 flex flex-col items-center justify-start gap-1.5 px-2 pt-3 pb-2 rounded-xl border bg-secondary/30 hover:bg-secondary/60 hover:-translate-y-0.5 active:scale-[0.97] transition-all text-center"
              >
                <div className="flex w-[78%] max-w-[4.5rem] aspect-square min-h-0 items-center justify-center overflow-hidden">
                  {icons['geoguessr'] ? (
                    <img src={icons['geoguessr']} alt="GeoGuessr" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xl sm:text-[2rem]">🎯</span>
                  )}
                </div>
                <p className="flex min-h-[2.5em] w-full items-center justify-center font-medium text-xs leading-tight text-balance">GeoGuessr</p>
              </button>
            )}
            {MINI_GAMES.map((game) => (
              <button
                key={game.id}
                onClick={() => selectGame(game.id)}
                className="min-w-0 flex flex-col items-center justify-start gap-1.5 px-2 pt-3 pb-2 rounded-xl border bg-secondary/30 hover:bg-secondary/60 hover:-translate-y-0.5 active:scale-[0.97] transition-all text-center"
              >
                <div className="flex w-[78%] max-w-[4.5rem] aspect-square min-h-0 items-center justify-center overflow-hidden">
                  {icons[game.id] || LOCAL_ICONS[game.id] ? (
                    <img src={icons[game.id] ?? LOCAL_ICONS[game.id]} alt={game.name} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xl sm:text-[2rem]">{game.emoji}</span>
                  )}
                </div>
                <p className="flex min-h-[2.5em] w-full items-center justify-center font-medium text-xs leading-tight text-balance">{game.name}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <MiniGamesLeaderboardGrid />
    </div>
  );
});
