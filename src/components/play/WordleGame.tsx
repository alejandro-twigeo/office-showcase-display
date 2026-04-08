import { useEffect, useCallback, useRef } from 'react';
import { useWordle, type LetterStatus } from '@/hooks/useWordle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Trophy, CheckCircle, XCircle } from 'lucide-react';

interface WordleGameProps {
  playerName: string;
}

function getStatusColor(status: LetterStatus): string {
  switch (status) {
    case 'correct': return 'bg-green-600 text-white border-green-600';
    case 'present': return 'bg-yellow-500 text-white border-yellow-500';
    case 'absent': return 'bg-muted-foreground/30 text-foreground border-muted-foreground/30';
    case 'empty': return 'bg-background border-border';
  }
}

export function WordleGame({ playerName }: WordleGameProps) {
  const isMobile = useIsMobile();
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
    alreadyPlayed,
    existingScore,
    roundNumber,
  } = useWordle(playerName);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentRowRef = useRef<HTMLDivElement>(null);
  const focusScrollTimeoutRef = useRef<number | null>(null);
  const scrollActiveRowIntoView = useCallback(() => {
    currentRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    if (focusScrollTimeoutRef.current != null) {
      window.clearTimeout(focusScrollTimeoutRef.current);
    }
    focusScrollTimeoutRef.current = window.setTimeout(scrollActiveRowIntoView, 150);
  }, [scrollActiveRowIntoView]);

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

  useEffect(() => {
    if (gameOver) return;
    focusInput();
    const timer = window.setTimeout(focusInput, 250);
    return () => {
      window.clearTimeout(timer);
      if (focusScrollTimeoutRef.current != null) {
        window.clearTimeout(focusScrollTimeoutRef.current);
      }
    };
  }, [gameOver, focusInput]);

  useEffect(() => {
    if (!isMobile || gameOver || typeof window === 'undefined' || !window.visualViewport) return;
    const handleViewportChange = () => {
      window.setTimeout(scrollActiveRowIntoView, 100);
    };
    window.visualViewport.addEventListener('resize', handleViewportChange);
    return () => window.visualViewport?.removeEventListener('resize', handleViewportChange);
  }, [isMobile, gameOver, scrollActiveRowIntoView]);

  const gridWidthClass = isMobile ? 'w-full' : 'w-full max-w-[26rem]';

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
        <p className="text-xs text-muted-foreground">Guess the 5-letter word. Start typing for your first guess and click Enter to submit. Up to {settings.wordle_attempt_points[0]} pts!</p>
      </CardHeader>
      <CardContent className={`space-y-3 ${isMobile ? 'pb-28' : ''}`}>
        {/* Grid */}
        <div
          className="flex flex-col items-center gap-3"
          onClick={focusInput}
        >
          {!gameOver && (
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              spellCheck={false}
              enterKeyHint="done"
              value={currentInput}
              onChange={(e) => {
                const nextValue = e.target.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
                setCurrentInput(nextValue);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitGuess();
                }
              }}
              className="sr-only"
              aria-label="Wordle input"
            />
          )}
          <div className={gridWidthClass}>
            {gridRows.map((row, ri) => (
              <div
                key={ri}
                ref={ri === guesses.length && !gameOver ? currentRowRef : undefined}
                className="grid grid-cols-5 gap-2 w-full"
              >
                {row.map((cell, ci) => (
                  <div
                    key={ci}
                    className={`aspect-square w-full flex items-center justify-center text-[clamp(1.6rem,7vw,2.35rem)] font-bold uppercase border-2 rounded transition-colors ${getStatusColor(cell.status)}`}
                  >
                    {cell.letter}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {!gameOver && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`${gridWidthClass} ${isMobile ? '' : 'hidden'}`}
              onClick={focusInput}
            >
              Show Keyboard
            </Button>
          )}
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

      </CardContent>
    </Card>
  );
}
