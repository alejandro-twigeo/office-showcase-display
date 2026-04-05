import { useEffect, useCallback } from 'react';
import { useWordle, type LetterStatus } from '@/hooks/useWordle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, CheckCircle, XCircle } from 'lucide-react';

interface WordleGameProps {
  playerName: string;
}

const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'],
];

function getStatusColor(status: LetterStatus): string {
  switch (status) {
    case 'correct': return 'bg-green-600 text-white border-green-600';
    case 'present': return 'bg-yellow-500 text-white border-yellow-500';
    case 'absent': return 'bg-muted-foreground/30 text-foreground border-muted-foreground/30';
    case 'empty': return 'bg-background border-border';
  }
}

function getKeyColor(status: LetterStatus | undefined): string {
  if (!status) return 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
  switch (status) {
    case 'correct': return 'bg-green-600 text-white';
    case 'present': return 'bg-yellow-500 text-white';
    case 'absent': return 'bg-muted-foreground/40 text-muted-foreground';
    default: return 'bg-secondary text-secondary-foreground';
  }
}

export function WordleGame({ playerName }: WordleGameProps) {
  const {
    guesses,
    currentInput,
    setCurrentInput,
    submitGuess,
    gameOver,
    won,
    error,
    targetWord,
    earnedPoints,
    existingEarnedPoints,
    settings,
    keyStatuses,
    alreadyPlayed,
    existingScore,
    roundNumber,
  } = useWordle(playerName);

  const keyMap = keyStatuses();

  const handleKeyPress = useCallback((key: string) => {
    if (gameOver) return;
    if (key === 'enter') {
      submitGuess();
    } else if (key === '⌫' || key === 'backspace') {
      setCurrentInput(prev => prev.slice(0, -1));
    } else if (/^[a-z]$/.test(key) && currentInput.length < 5) {
      setCurrentInput(prev => prev + key);
    }
  }, [gameOver, submitGuess, setCurrentInput, currentInput.length]);

  // Physical keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'enter' || key === 'backspace' || /^[a-z]$/.test(key)) {
        e.preventDefault();
        handleKeyPress(key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKeyPress]);

  // Build grid rows (6 total)
  const gridRows = [];
  for (let row = 0; row < 6; row++) {
    const cells = [];
    if (row < guesses.length) {
      // Submitted guess
      for (let col = 0; col < 5; col++) {
        cells.push({
          letter: guesses[row].word[col],
          status: guesses[row].statuses[col],
        });
      }
    } else if (row === guesses.length && !gameOver) {
      // Current input row
      for (let col = 0; col < 5; col++) {
        cells.push({
          letter: currentInput[col] ?? '',
          status: 'empty' as LetterStatus,
        });
      }
    } else {
      // Empty row
      for (let col = 0; col < 5; col++) {
        cells.push({ letter: '', status: 'empty' as LetterStatus });
      }
    }
    gridRows.push(cells);
  }

  if (alreadyPlayed && existingScore) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            🟩 Wordle — Round {roundNumber}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6 space-y-2">
          {existingScore.solved ? (
            <>
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
              <p className="font-medium text-foreground">You solved it in {existingScore.attempts} attempt{existingScore.attempts > 1 ? 's' : ''}!</p>
              <p className="text-sm text-muted-foreground">+{existingEarnedPoints} pts earned</p>
            </>
          ) : (
            <>
              <XCircle className="h-10 w-10 text-destructive mx-auto" />
              <p className="font-medium text-foreground">Better luck next round!</p>
              <p className="text-sm text-muted-foreground">The word was: <strong>{targetWord}</strong></p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          🟩 Wordle — Round {roundNumber}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Guess the 5-letter word. Up to {settings.wordle_attempt_points[0]} pts!</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Grid */}
        <div className="flex flex-col items-center gap-[3px]">
          {gridRows.map((row, ri) => (
            <div key={ri} className="flex gap-[3px]">
              {row.map((cell, ci) => (
                <div
                  key={ci}
                  className={`w-[calc((100vw-4rem)/5)] max-w-14 aspect-square flex items-center justify-center text-lg font-bold uppercase border-2 rounded transition-colors ${getStatusColor(cell.status)}`}
                >
                  {cell.letter}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && <p className="text-xs text-destructive text-center">{error}</p>}

        {/* Game over state */}
        {gameOver && (
          <div className="text-center py-2 space-y-1">
            {won ? (
              <>
                <div className="flex items-center justify-center gap-2">
                  <Trophy className="h-5 w-5 text-warning" />
                  <span className="font-semibold text-foreground">You got it in {guesses.length}!</span>
                </div>
                <p className="text-sm text-muted-foreground">+{earnedPoints} pts</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-destructive">Out of attempts!</p>
                <p className="text-sm text-muted-foreground">The word was: <strong className="text-foreground">{targetWord}</strong></p>
              </>
            )}
          </div>
        )}

        {/* Keyboard */}
        {!gameOver && (
          <div className="flex flex-col items-center gap-1">
            {KEYBOARD_ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-0.5">
                {row.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className={`${
                      key.length > 1 ? 'px-2 text-xs' : 'w-8 sm:w-9'
                    } h-10 rounded font-medium transition-colors ${getKeyColor(keyMap.get(key))}`}
                  >
                    {key === '⌫' ? '⌫' : key.toUpperCase()}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
