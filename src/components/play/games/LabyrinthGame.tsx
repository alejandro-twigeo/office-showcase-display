import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore, todayDate, dateSeed, seededRandom } from '@/hooks/useMinigameScore';
import { useMinigameSettings } from '@/hooks/useMinigameSettings';
import { CheckCircle, Clock, RotateCcw } from 'lucide-react';

const GAME_ID = 'labyrinth';
const MAZE_SIZE = 15; // odd number for walls + paths

type Cell = 'wall' | 'path' | 'start' | 'end';

/** Generate maze using recursive backtracker, then open extra walls for multiple paths */
function generateMaze(size: number, rng: () => number): Cell[][] {
  const grid: Cell[][] = Array.from({ length: size }, () => Array(size).fill('wall'));

  function carve(r: number, c: number) {
    grid[r][c] = 'path';
    const dirs = [[-2, 0], [2, 0], [0, -2], [0, 2]].sort(() => rng() - 0.5);
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr > 0 && nr < size - 1 && nc > 0 && nc < size - 1 && grid[nr][nc] === 'wall') {
        grid[r + dr / 2][c + dc / 2] = 'path';
        carve(nr, nc);
      }
    }
  }

  carve(1, 1);

  // Open extra walls to create multiple possible paths (≈15% of interior walls)
  const interiorWalls: [number, number][] = [];
  for (let r = 2; r < size - 2; r++) {
    for (let c = 2; c < size - 2; c++) {
      if (grid[r][c] === 'wall') {
        // Only open walls that connect two path cells (horizontally or vertically)
        const hConnect = r > 0 && r < size - 1 && grid[r - 1][c] !== 'wall' && grid[r + 1][c] !== 'wall';
        const vConnect = c > 0 && c < size - 1 && grid[r][c - 1] !== 'wall' && grid[r][c + 1] !== 'wall';
        if (hConnect || vConnect) interiorWalls.push([r, c]);
      }
    }
  }
  interiorWalls.sort(() => rng() - 0.5);
  const toOpen = Math.floor(interiorWalls.length * 0.15);
  for (let i = 0; i < toOpen; i++) {
    const [r, c] = interiorWalls[i];
    grid[r][c] = 'path';
  }

  grid[1][1] = 'start';
  grid[size - 2][size - 2] = 'end';
  return grid;
}

interface LabyrinthGameProps {
  playerName: string;
  roundId?: string;
}

export function LabyrinthGame({ playerName, roundId }: LabyrinthGameProps) {
  const deviceId = useDeviceId();
  const settings = useMinigameSettings();
  const { data: todayScore } = useMinigameTodayScore(GAME_ID, playerName, roundId);
  const submitScore = useSubmitMinigameScore();

  const maze = useMemo(() => {
    const seed = dateSeed(todayDate());
    return generateMaze(MAZE_SIZE, seededRandom(seed + 4));
  }, []);

  const [playerPos, setPlayerPos] = useState<{ r: number; c: number }>({ r: 1, c: 1 });
  const [path, setPath] = useState<Set<string>>(new Set(['1-1']));
  const [resets, setResets] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (startTime && !done) {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [startTime, done]);

  const resetPosition = useCallback(() => {
    setPlayerPos({ r: 1, c: 1 });
    setPath(new Set(['1-1']));
    setResets(r => r + 1);
  }, []);

  const movePlayer = useCallback(async (dr: number, dc: number) => {
    if (done) return;
    const nr = playerPos.r + dr;
    const nc = playerPos.c + dc;
    if (nr < 0 || nr >= MAZE_SIZE || nc < 0 || nc >= MAZE_SIZE) return;
    if (maze[nr][nc] === 'wall') {
      resetPosition();
      return;
    }
    if (!startTime) setStartTime(Date.now());
    setPlayerPos({ r: nr, c: nc });
    setPath(prev => new Set(prev).add(`${nr}-${nc}`));

    if (maze[nr][nc] === 'end') {
      setDone(true);
      const time = Math.floor((Date.now() - (startTime ?? Date.now())) / 1000);
      const timeScore = Math.round(settings.labyrinth_max_points / (1 + time / settings.labyrinth_time_param));
      const penalty = resets * settings.labyrinth_reset_penalty;
      const score = Math.max(1, timeScore - penalty);
      await submitScore.mutateAsync({
        game_id: GAME_ID,
        player_name: playerName,
        device_id: deviceId,
        score,
        round_id: roundId,
        meta: { time_seconds: time, resets },
      });
    }
  }, [playerPos, done, maze, startTime, settings, resets, playerName, deviceId, submitScore, resetPosition]);

  // Keyboard controls — prevent page scroll on arrow keys
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); movePlayer(-1, 0); }
      else if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); movePlayer(1, 0); }
      else if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); movePlayer(0, -1); }
      else if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); movePlayer(0, 1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [movePlayer]);

  // Continuous touch-drag: trace your finger across the maze grid
  const mazeGridRef = useRef<HTMLDivElement>(null);

  const getCellFromTouch = useCallback((clientX: number, clientY: number): { r: number; c: number } | null => {
    if (!mazeGridRef.current) return null;
    const rect = mazeGridRef.current.getBoundingClientRect();
    const cellW = rect.width / MAZE_SIZE;
    const cellH = rect.height / MAZE_SIZE;
    const c = Math.floor((clientX - rect.left) / cellW);
    const r = Math.floor((clientY - rect.top) / cellH);
    if (r < 0 || r >= MAZE_SIZE || c < 0 || c >= MAZE_SIZE) return null;
    return { r, c };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (done) return;
    e.preventDefault(); // prevent page scroll while dragging on maze
    const t = e.touches[0];
    const cell = getCellFromTouch(t.clientX, t.clientY);
    if (!cell) return;
    const { r, c } = cell;
    // Only move if adjacent to current position (1 step away, no diagonal)
    const dr = r - playerPos.r;
    const dc = c - playerPos.c;
    if (Math.abs(dr) + Math.abs(dc) === 1) {
      movePlayer(dr, dc);
    }
  }, [done, getCellFromTouch, playerPos, movePlayer]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!startTime && !done) setStartTime(Date.now());
    // Also process the initial touch position
    const t = e.touches[0];
    const cell = getCellFromTouch(t.clientX, t.clientY);
    if (!cell) return;
    const { r, c } = cell;
    const dr = r - playerPos.r;
    const dc = c - playerPos.c;
    if (Math.abs(dr) + Math.abs(dc) === 1) {
      movePlayer(dr, dc);
    }
  }, [done, startTime, getCellFromTouch, playerPos, movePlayer]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (todayScore) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">🌀 Labyrinth</CardTitle></CardHeader>
        <CardContent className="text-center py-6 space-y-2">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
          <p className="font-medium">{todayScore.score} pts</p>
          <p className="text-xs text-muted-foreground">
            {formatTime((todayScore.meta as any)?.time_seconds ?? 0)} · {(todayScore.meta as any)?.resets ?? 0} resets
          </p>
        </CardContent>
      </Card>
    );
  }

  const cellSize = `min(calc((100vw - 2rem) / ${MAZE_SIZE}), 2rem)`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">🌀 Labyrinth</CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(elapsed)}</span>
          <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" /> {resets} resets</span>
        </div>
        <p className="text-xs text-muted-foreground">Use arrow keys or drag your finger across the maze.</p>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <div
            ref={mazeGridRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            className="inline-grid gap-0 border border-foreground rounded overflow-hidden touch-none"
            style={{ gridTemplateColumns: `repeat(${MAZE_SIZE}, ${cellSize})` }}>
            {maze.map((row, ri) => row.map((cell, ci) => {
              const isPlayer = ri === playerPos.r && ci === playerPos.c;
              const isPath = path.has(`${ri}-${ci}`);
              return (
                <div
                  key={`${ri}-${ci}`}
                  style={{ width: cellSize, height: cellSize }}
                  className={`flex items-center justify-center text-xs transition-colors
                    ${cell === 'wall' ? 'bg-foreground' : ''}
                    ${cell === 'start' ? 'bg-green-500/30' : ''}
                    ${cell === 'end' ? 'bg-primary/30' : ''}
                    ${cell === 'path' && isPath && !isPlayer ? 'bg-primary/10' : ''}
                    ${cell === 'path' && !isPath ? 'bg-background' : ''}
                    ${isPlayer ? 'bg-primary' : ''}`}
                >
                  {cell === 'start' && !isPlayer && '🏁'}
                  {cell === 'end' && '⭐'}
                  {isPlayer && '●'}
                </div>
              );
            }))}
          </div>
        </div>


        {done && (
          <p className="text-center font-semibold text-primary mt-3">🎉 You escaped!</p>
        )}
      </CardContent>
    </Card>
  );
}
