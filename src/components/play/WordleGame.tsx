import { useEffect, useCallback, useRef, useState } from 'react';
import { buzz } from '@/lib/haptics';
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
  // Keep this session's finished board on screen after the score saves
  // (saving makes the hook switch to "already played" and clear its guesses)
  const [finishedGuesses, setFinishedGuesses] = useState<typeof guesses | null>(null);
  useEffect(() => {
    if (gameOver && guesses.length) setFinishedGuesses(guesses);
  }, [gameOver, guesses]);
  useEffect(() => setFinishedGuesses(null), [roundId]);
  const shownGuesses = finishedGuesses ?? guesses;
  const inputRef = useRef<HTMLInputElement>(null);

  // Reveal a submitted guess one tile at a time, like the real thing
  const FLIP_MS = 230;
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [revealedTiles, setRevealedTiles] = useState(5);
  const prevGuessCount = useRef(shownGuesses.length);
  useEffect(() => {
    if (shownGuesses.length <= prevGuessCount.current) {
      prevGuessCount.current = shownGuesses.length;
      return;
    }
    const row = shownGuesses.length - 1;
    prevGuessCount.current = shownGuesses.length;
    setRevealRow(row);
    setRevealedTiles(0);
    const timers = [1, 2, 3, 4, 5].map((n) => window.setTimeout(() => setRevealedTiles(n), n * FLIP_MS));
    timers.push(window.setTimeout(() => setRevealRow(null), 5 * FLIP_MS + 200));
    return () => timers.forEach(window.clearTimeout);
  }, [shownGuesses.length]);
  const revealing = revealRow !== null;

  // Shake the row when a guess is rejected
  const [shakeKey, setShakeKey] = useState(0);
  useEffect(() => {
    if (!error) return;
    setShakeKey((k) => k + 1);
    buzz(40);
  }, [error]);

  // Little celebration when the word is found
  useEffect(() => {
    if (gameOver && won && !revealing) buzz([15, 50, 15, 50, 30]);
  }, [gameOver, won, revealing]);
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
    if (gameOver || revealing) return;
    if (key !== 'enter') buzz(5);
    if (key === 'enter') {
      submitGuess();
    } else if (key === '⌫' || key === 'backspace') {
      setCurrentInput(prev => prev.slice(0, -1));
    } else if (/^[a-z]$/.test(key) && currentInput.length < 5) {
      setCurrentInput(prev => prev + key);
    }
  }, [gameOver, revealing, submitGuess, setCurrentInput, currentInput.length]);

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
  const keyboardStatus = (revealing ? shownGuesses.slice(0, -1) : shownGuesses).reduce<Record<string, LetterStatus>>((acc, guess) => {
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
    if (row < shownGuesses.length) {
      // Submitted guess
      for (let col = 0; col < 5; col++) {
        cells.push({
          letter: shownGuesses[row].word[col],
          status: shownGuesses[row].statuses[col],
        });
      }
    } else if (row === shownGuesses.length && !gameOver) {
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

  const showResult = gameOver && !revealing;
  const keyboard = !showResult ? (
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

  if (alreadyPlayed && existingScore && !finishedGuesses) {
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
            <div className={`${gridWidthClass} [&>*:last-child]:mb-0`}>
              {gridRows.map((row, ri) => (
                <div
                  key={ri === shownGuesses.length ? `row-${ri}-${shakeKey}` : `row-${ri}`}
                  ref={ri === shownGuesses.length && !gameOver ? currentRowRef : undefined}
                  className={`grid grid-cols-5 gap-2 w-full mb-2 ${ri === shownGuesses.length && shakeKey > 0 && error ? 'wordle-shake' : ''}`}
                  style={{ perspective: 600 }}
                >
                  {row.map((cell, ci) => {
                    const waiting = ri === revealRow && ci >= revealedTiles;
                    const justFlipped = ri === revealRow && ci < revealedTiles;
                    const winRow = showResult && won && ri === shownGuesses.length - 1;
                    const shown = waiting ? ('empty' as LetterStatus) : cell.status;
                    return (
                      <div
                        key={`${ci}-${cell.letter}-${waiting ? 'w' : 'r'}`}
                        className={[
                          'aspect-square w-full flex items-center justify-center text-[clamp(1.6rem,7vw,2.35rem)] font-bold uppercase border-2 rounded-lg',
                          getStatusColor(shown),
                          cell.letter && shown === 'empty' ? 'border-foreground/45' : '',
                          ri === shownGuesses.length && cell.letter ? 'tile-pop' : '',
                          justFlipped ? 'tile-flip' : '',
                          winRow ? 'wordle-bounce' : '',
                        ].join(' ')}
                        style={winRow ? { animationDelay: `${ci * 90}ms` } : undefined}
                      >
                        {cell.letter}
                      </div>
                    );
                  })}
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
        {showResult && (
          <div className="text-center py-2 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {won ? (
              <>
                <div className="flex items-center justify-center gap-2">
                  <Trophy className="h-5 w-5 text-warning" />
                  <span className="font-semibold text-foreground">You got it in {shownGuesses.length}!</span>
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
