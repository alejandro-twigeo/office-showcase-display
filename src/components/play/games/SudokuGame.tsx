import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore, todayDate, dateSeed, seededRandom } from '@/hooks/useMinigameScore';
import { useMinigameSettings } from '@/hooks/useMinigameSettings';
import { CheckCircle, Clock } from 'lucide-react';

const GAME_ID = 'sudoku';

type Grid = (number | null)[][];

/** Generate a valid solved 6x6 sudoku grid */
function generateSolved(rng: () => number): number[][] {
  const grid: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));

  function isValid(row: number, col: number, num: number): boolean {
    for (let i = 0; i < 6; i++) {
      if (grid[row][i] === num || grid[i][col] === num) return false;
    }
    const br = Math.floor(row / 2) * 2;
    const bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 2; r++) {
      for (let c = bc; c < bc + 3; c++) {
        if (grid[r][c] === num) return false;
      }
    }
    return true;
  }

  function fill(pos: number): boolean {
    if (pos === 36) return true;
    const row = Math.floor(pos / 6);
    const col = pos % 6;
    const nums = [1, 2, 3, 4, 5, 6].sort(() => rng() - 0.5);
    for (const n of nums) {
      if (isValid(row, col, n)) {
        grid[row][col] = n;
        if (fill(pos + 1)) return true;
        grid[row][col] = 0;
      }
    }
    return false;
  }

  fill(0);
  return grid;
}

/** Create puzzle by removing cells */
function createPuzzle(solved: number[][], rng: () => number, removals: number): Grid {
  const puzzle: Grid = solved.map(r => [...r]);
  const positions = Array.from({ length: 36 }, (_, i) => i).sort(() => rng() - 0.5);
  for (let i = 0; i < Math.min(removals, 36); i++) {
    const r = Math.floor(positions[i] / 6);
    const c = positions[i] % 6;
    puzzle[r][c] = null;
  }
  return puzzle;
}

interface SudokuGameProps {
  playerName: string;
}

export function SudokuGame({ playerName }: SudokuGameProps) {
  const deviceId = useDeviceId();
  const settings = useMinigameSettings();
  const { data: todayScore } = useMinigameTodayScore(GAME_ID, playerName);
  const submitScore = useSubmitMinigameScore();

  const { solved, puzzle } = useMemo(() => {
    const seed = dateSeed(todayDate());
    const rng = seededRandom(seed + 2);
    const s = generateSolved(rng);
    // Hard: remove 24 of 36 cells
    const p = createPuzzle(s, rng, 24);
    return { solved: s, puzzle: p };
  }, []);

  const [grid, setGrid] = useState<Grid>(() => puzzle.map(r => [...r]));
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Timer
  useEffect(() => {
    if (startTime && !done) {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [startTime, done]);

  const handleCellClick = (r: number, c: number) => {
    if (puzzle[r][c] !== null) return; // Fixed cell
    setSelectedCell({ r, c });
    if (!startTime) setStartTime(Date.now());
  };

  const handleNumberInput = async (num: number) => {
    if (!selectedCell) return;
    const { r, c } = selectedCell;
    const newGrid = grid.map(row => [...row]);
    newGrid[r][c] = num === 0 ? null : num;
    setGrid(newGrid);

    // Check errors
    const newErrors = new Set<string>();
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        if (newGrid[row][col] !== null && newGrid[row][col] !== solved[row][col]) {
          newErrors.add(`${row}-${col}`);
        }
      }
    }
    setErrors(newErrors);

    // Check completion
    const isComplete = newGrid.every((row, ri) => row.every((cell, ci) => cell === solved[ri][ci]));
    if (isComplete) {
      setDone(true);
      const time = Math.floor((Date.now() - (startTime ?? Date.now())) / 1000);
      const score = Math.max(1, Math.round(settings.sudoku_max_points / (1 + time / settings.sudoku_time_param)));
      await submitScore.mutateAsync({
        game_id: GAME_ID,
        player_name: playerName,
        device_id: deviceId,
        score,
        meta: { time_seconds: time },
      });
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (todayScore) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">🔢 Sudoku 6×6</CardTitle></CardHeader>
        <CardContent className="text-center py-6 space-y-2">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
          <p className="font-medium">{todayScore.score} pts</p>
          <p className="text-xs text-muted-foreground">Completed in {formatTime((todayScore.meta as any)?.time_seconds ?? 0)}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">🔢 Sudoku 6×6</CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> {formatTime(elapsed)}
          <span className="ml-auto">Hard · 2×3 blocks</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-center">
          <div className="inline-grid grid-cols-6 gap-0 border-2 border-foreground rounded">
            {grid.map((row, ri) => row.map((cell, ci) => {
              const isFixed = puzzle[ri][ci] !== null;
              const isSelected = selectedCell?.r === ri && selectedCell?.c === ci;
              const isError = errors.has(`${ri}-${ci}`);
              const borderR = ci === 2 ? 'border-r-2 border-r-foreground' : 'border-r border-r-border';
              const borderB = ri === 1 || ri === 3 ? 'border-b-2 border-b-foreground' : 'border-b border-b-border';
              return (
                <button
                  key={`${ri}-${ci}`}
                  onClick={() => handleCellClick(ri, ci)}
                  className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg font-bold transition-colors
                    ${borderR} ${borderB}
                    ${isFixed ? 'text-foreground bg-muted/50' : 'text-primary cursor-pointer hover:bg-primary/10'}
                    ${isSelected ? 'bg-primary/20 ring-2 ring-primary' : ''}
                    ${isError ? 'text-destructive bg-destructive/10' : ''}`}
                >
                  {cell ?? ''}
                </button>
              );
            }))}
          </div>
        </div>

        {/* Number pad */}
        <div className="flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <Button key={n} variant="outline" size="sm" className="w-10 h-10 text-lg font-bold"
              onClick={() => handleNumberInput(n)} disabled={!selectedCell}>
              {n}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="w-10 h-10 text-sm"
            onClick={() => handleNumberInput(0)} disabled={!selectedCell}>
            ✕
          </Button>
        </div>

        {done && (
          <div className="text-center py-2">
            <p className="font-semibold text-primary">🎉 Solved in {formatTime(elapsed)}!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
