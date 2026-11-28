import { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { GameTile } from './GameTile';
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
import { ActivityChart } from './ActivityChart';

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
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5">
        {includeGeoGuessr && (
          <GameTile id="geoguessr" name="GeoGuessr" icon={icons['geoguessr']} emoji="🎯" onClick={() => onSelectGeoGuessr?.()} />
        )}
        {MINI_GAMES.map((game) => (
          <GameTile
            key={game.id}
            id={game.id}
            name={game.name}
            icon={icons[game.id] ?? LOCAL_ICONS[game.id]}
            emoji={game.emoji}
            onClick={() => selectGame(game.id)}
          />
        ))}
      </div>

      {/* How the office has been playing: the last 30 days, by city, department or person */}
      <ActivityChart playerName={playerName} />

      <MiniGamesLeaderboardGrid />
    </div>
  );
});
