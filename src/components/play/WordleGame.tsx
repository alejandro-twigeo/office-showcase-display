import { useEffect, useCallback, useRef } from 'react';
import { useWordle, type LetterStatus } from '@/hooks/useWordle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Trophy, CheckCircle, XCircle } from 'lucide-react';

interface WordleGameProps {
  playerName: string;
  roundId?: string;
}

function getStatusColor(status: LetterStatus): string {
  switch (status) {
    case 'correct': return 'bg-green-600 text-white border-green-600';
    case 'present': return 'bg-yellow-500 text-white border-yellow-500';
    case 'absent': return 'bg-muted-foreground/30 text-foreground border-muted-foreground/30';
    case 'empty': return 'bg-background border-border';
  }
}

const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace'],
] as const;

function getKeyboardKeyClass(status: LetterStatus | undefined) {
  switch (status) {
    case 'correct':
      return 'bg-green-600 text-white border-green-600';
    case 'present':
      return 'bg-yellow-500 text-white border-yellow-500';
    case 'absent':
      return 'bg-muted-foreground/30 text-foreground border-muted-foreground/30';
    default:
      return 'bg-background text-foreground border-border hover:bg-secondary';
  }
}

function getActionKeyClass(key: string) {
  if (key === 'enter') {
    return 'border-emerald-500 bg-emerald-100 hover:bg-emerald-200';
  }
  if (key === 'backspace') {
    return 'border-slate-300 bg-slate-100 hover:bg-slate-200';
  }
  return '';
}

function getKeyboardRowTemplate(row: readonly string[], isMobile: boolean) {
  if (isMobile) {
    return `repeat(${row.length}, minmax(0, 1fr))`;
  }

  return row
    .map((key) => (key === 'enter' || key === 'backspace' ? 'minmax(4.5rem, 1.35fr)' : 'minmax(2.6rem, 1fr)'))
    .join(' ');
}

export function WordleGame({ playerName, roundId }: WordleGameProps) {
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
  } = useWordle(playerName, roundId);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentRowRef = useRef<HTMLDivElement>(null);
  const focusScrollTimeoutRef = useRef<number | null>(null);
  const scrollActiveRowIntoView = useCallback(() => {
    currentRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);
  const focusInput = useCallback(() => {
    if (isMobile) return;
    inputRef.current?.focus();
    if (focusScrollTimeoutRef.current != null) {
      window.clearTimeout(focusScrollTimeoutRef.current);
    }
    focusScrollTimeoutRef.current = window.setTimeout(scrollActiveRowIntoView, 150);
  }, [isMobile, scrollActiveRowIntoView]);

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
  const keyboardStatus = guesses.reduce<Record<string, LetterStatus>>((acc, guess) => {
    guess.word.split('').forEach((letter, index) => {
      const nextStatus = guess.statuses[index];
      const currentStatus = acc[letter];
      if (currentStatus === 'correct') return;
      if (currentStatus === 'present' && nextStatus === 'absent') return;
      acc[letter] = nextStatus;
    });
    return acc;
  }, {});

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

  const keyboard = !gameOver ? (
    <div className={`w-full ${isMobile ? '' : 'max-w-[17rem]'} space-y-2`} onClick={(e) => e.stopPropagation()}>
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={`grid gap-1.5 ${rowIndex === 1 ? 'mx-auto w-[92%]' : ''}`}
          style={{ gridTemplateColumns: getKeyboardRowTemplate(row, isMobile) }}
        >
          {row.map((key) => {
            const isActionKey = key === 'enter' || key === 'backspace';
            const label = key === 'backspace' ? '⌫' : key === 'enter' ? (isMobile ? '↵' : 'Enter') : key.toUpperCase();
            return (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                className={[
                  'h-12 rounded-xl border px-0 font-semibold uppercase transition-colors',
                  '!text-slate-900 active:!text-slate-900',
                  isActionKey ? 'text-[0.72rem]' : 'text-sm',
                  isActionKey ? getActionKeyClass(key) : getKeyboardKeyClass(keyboardStatus[key]),
                ].join(' ')}
                onClick={() => {
                  handleKeyPress(key);
                  if (!isMobile) {
                    focusInput();
                  }
                }}
              >
                <span
                  className={[
                    'text-slate-900',
                    key === 'enter' && isMobile ? 'text-xl leading-none' : '',
                  ].join(' ')}
                >
                  {label}
                </span>
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  ) : null;

  if (alreadyPlayed && existingScore) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            🟩 Wordle
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
          🟩 Wordle
        </CardTitle>
        <p className="text-xs text-muted-foreground">Guess the 5-letter word. Up to {settings.wordle_attempt_points[0]} pts.</p>
      </CardHeader>
      <CardContent className={`space-y-3 ${isMobile ? 'pb-28' : ''}`}>
        {/* Grid */}
        <div
          className={`flex gap-4 ${isMobile ? 'flex-col items-start' : 'items-center justify-center'}`}
          onClick={() => {
            if (!isMobile) {
              focusInput();
            }
          }}
        >
          <div className={`w-full ${isMobile ? '' : 'max-w-[26rem]'} space-y-3`}>
            {!gameOver && (
              <input
                ref={inputRef}
                type="text"
                inputMode={isMobile ? 'none' : 'text'}
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
                onFocus={(e) => {
                  if (isMobile) {
                    e.target.blur();
                  }
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
            {isMobile && keyboard}
          </div>
          {!isMobile && keyboard}
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
