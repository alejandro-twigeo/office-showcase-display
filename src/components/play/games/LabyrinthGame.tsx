import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore, todayDate, dateSeed, seededRandom } from '@/hooks/useMinigameScore';
import { useMinigameSettings } from '@/hooks/useMinigameSettings';
import { useIsMobile } from '@/hooks/use-mobile';
import { CheckCircle, Clock, RotateCcw, Undo2 } from 'lucide-react';

const GAME_ID = 'labyrinth';

// ---------- Puzzle types ----------
interface ZipPuzzle {
  size: number;
  /** checkpoints[r][c] = number (1-based) or 0 if not a checkpoint */
  checkpoints: number[][];
  /** walls: Set of "r1,c1-r2,c2" (sorted) indicating blocked edges */
  walls: Set<string>;
  /** The solution path as [r,c][] */
  solution: [number, number][];
}

function wallKey(r1: number, c1: number, r2: number, c2: number): string {
  if (r1 < r2 || (r1 === r2 && c1 < c2)) return `${r1},${c1}-${r2},${c2}`;
  return `${r2},${c2}-${r1},${c1}`;
}

// ---------- Puzzle generation ----------
function generateZipPuzzle(rng: () => number): ZipPuzzle {
  const size = 6; // 6x6 grid = 36 cells
  const total = size * size;

  // Generate a Hamiltonian path using randomized Warnsdorf's heuristic + backtracking
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  const path: [number, number][] = [];

  // Start from a random cell
  const startR = Math.floor(rng() * size);
  const startC = Math.floor(rng() * size);

  function neighbors(r: number, c: number): [number, number][] {
    const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const result: [number, number][] = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && !visited[nr][nc]) {
        result.push([nr, nc]);
      }
    }
    return result;
  }

  function degree(r: number, c: number): number {
    return neighbors(r, c).length;
  }

  function solve(r: number, c: number, depth: number): boolean {
    visited[r][c] = true;
    path.push([r, c]);
    if (depth === total) return true;

    // Sort neighbors by Warnsdorf (fewest onward moves), with random tiebreak
    const nbrs = neighbors(r, c);
    nbrs.sort((a, b) => {
      const da = degree(a[0], a[1]);
      const db = degree(b[0], b[1]);
      return da !== db ? da - db : rng() - 0.5;
    });

    for (const [nr, nc] of nbrs) {
      if (solve(nr, nc, depth + 1)) return true;
    }

    visited[r][c] = false;
    path.pop();
    return false;
  }

  // Try a few starting positions if needed
  let found = false;
  const starts: [number, number][] = [[startR, startC]];
  // Add more random starts as fallback
  for (let i = 0; i < 10; i++) {
    starts.push([Math.floor(rng() * size), Math.floor(rng() * size)]);
  }
  for (const [sr, sc] of starts) {
    // Reset
    for (let r = 0; r < size; r++) visited[r].fill(false);
    path.length = 0;
    if (solve(sr, sc, 1)) { found = true; break; }
  }

  if (!found) {
    // Fallback: snake path
    path.length = 0;
    for (let r = 0; r < size; r++) {
      if (r % 2 === 0) {
        for (let c = 0; c < size; c++) path.push([r, c]);
      } else {
        for (let c = size - 1; c >= 0; c--) path.push([r, c]);
      }
    }
  }

  // Place checkpoints along the path
  const checkpoints = Array.from({ length: size }, () => Array(size).fill(0));
  // Always mark first and last
  checkpoints[path[0][0]][path[0][1]] = 1;
  checkpoints[path[total - 1][0]][path[total - 1][1]] = total;

  // Place 5-6 intermediate checkpoints so total visible checkpoints is 7-8 including start/end
  const numCheckpoints = 5 + Math.floor(rng() * 2); // 5-6 intermediate
  const step = total / (numCheckpoints + 2);
  let cpNum = 2;
  for (let i = 1; i < numCheckpoints + 1; i++) {
    const idx = Math.round(step * i);
    if (idx > 0 && idx < total - 1) {
      const [cr, cc] = path[idx];
      if (checkpoints[cr][cc] === 0) {
        checkpoints[cr][cc] = idx + 1; // 1-based position in path
        cpNum++;
      }
    }
  }

  // Renumber checkpoints sequentially
  const cpEntries: { r: number; c: number; pathIdx: number }[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (checkpoints[r][c] > 0) {
        cpEntries.push({ r, c, pathIdx: checkpoints[r][c] - 1 });
      }
    }
  }
  cpEntries.sort((a, b) => a.pathIdx - b.pathIdx);
  // Clear and renumber
  for (let r = 0; r < size; r++) checkpoints[r].fill(0);
  cpEntries.forEach((e, i) => {
    checkpoints[e.r][e.c] = i + 1;
  });

  // Add a few walls (edges that the path does NOT use) to increase difficulty
  const pathEdges = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) {
    pathEdges.add(wallKey(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]));
  }

  const walls = new Set<string>();
  // Collect all grid edges not on the path
  const nonPathEdges: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (r + 1 < size) {
        const k = wallKey(r, c, r + 1, c);
        if (!pathEdges.has(k)) nonPathEdges.push(k);
      }
      if (c + 1 < size) {
        const k = wallKey(r, c, r, c + 1);
        if (!pathEdges.has(k)) nonPathEdges.push(k);
      }
    }
  }
  // Shuffle and pick 6-9 walls
  nonPathEdges.sort(() => rng() - 0.5);
  const numWalls = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < Math.min(numWalls, nonPathEdges.length); i++) {
    walls.add(nonPathEdges[i]);
  }

  return { size, checkpoints, walls, solution: path };
}

// ---------- Component ----------
interface LabyrinthGameProps {
  playerName: string;
  roundId?: string;
}

interface GridMetrics {
  left: number;
  top: number;
  cellW: number;
  cellH: number;
}

export function LabyrinthGame({ playerName, roundId }: LabyrinthGameProps) {
  const isMobile = useIsMobile();
  const deviceId = useDeviceId();
  const settings = useMinigameSettings();
  const { data: todayScore } = useMinigameTodayScore(GAME_ID, playerName, roundId);
  const submitScore = useSubmitMinigameScore();

  const puzzle = useMemo(() => {
    const seed = dateSeed(todayDate());
    return generateZipPuzzle(seededRandom(seed + 4));
  }, []);

  const [path, setPath] = useState<[number, number][]>([]);
  const [started, setStarted] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const gridRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const isDragging = useRef(false);
  const pathRef = useRef<[number, number][]>([]);
  const pendingPathRef = useRef<[number, number][]>([]);
  const gridMetricsRef = useRef<GridMetrics | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const lastPointerCellRef = useRef<[number, number] | null>(null);

  // Start timer immediately when game loads
  useEffect(() => {
    setStartTime(Date.now());
  }, []);

  useEffect(() => {
    if (startTime && !done) {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [startTime, done]);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  useEffect(() => {
    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const isAdjacent = useCallback((r1: number, c1: number, r2: number, c2: number) => {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
  }, []);

  const isWallBetween = useCallback((r1: number, c1: number, r2: number, c2: number) => {
    return puzzle.walls.has(wallKey(r1, c1, r2, c2));
  }, [puzzle]);

  const isInPath = useCallback((r: number, c: number, currentPath: [number, number][]) => {
    return currentPath.some(([pr, pc]) => pr === r && pc === c);
  }, []);

  const getNextRequiredCheckpoint = useCallback((currentPath: [number, number][]) => {
    // Find checkpoints already visited in order
    let nextCpValue = 1;
    for (const [pr, pc] of currentPath) {
      if (puzzle.checkpoints[pr][pc] === nextCpValue) {
        nextCpValue++;
      }
    }
    return nextCpValue;
  }, [puzzle]);

  const tryAddCell = useCallback((r: number, c: number, currentPath: [number, number][]) => {
    if (done) return currentPath;
    const { size, checkpoints } = puzzle;
    if (r < 0 || r >= size || c < 0 || c >= size) return currentPath;

    // If path is empty, must start at checkpoint 1
    if (currentPath.length === 0) {
      // Find the cell with checkpoint 1
      for (let cr = 0; cr < size; cr++) {
        for (let cc = 0; cc < size; cc++) {
          if (checkpoints[cr][cc] === 1 && cr === r && cc === c) {
            if (!started) {
              setStarted(true);
            }
            return [[r, c] as [number, number]];
          }
        }
      }
      return currentPath;
    }

    // Already in path?
    if (isInPath(r, c, currentPath)) return currentPath;

    const last = currentPath[currentPath.length - 1];
    if (!isAdjacent(last[0], last[1], r, c)) return currentPath;
    if (isWallBetween(last[0], last[1], r, c)) {
      setError(true);
      setTimeout(() => setError(false), 300);
      return currentPath;
    }

    // Check if this cell has a checkpoint that shouldn't be visited yet
    const nextCp = getNextRequiredCheckpoint(currentPath);
    const cellCp = checkpoints[r][c];
    if (cellCp > 0 && cellCp !== nextCp) {
      // Skipping a checkpoint or visiting out of order
      setError(true);
      setTimeout(() => setError(false), 300);
      return currentPath;
    }

    return [...currentPath, [r, c] as [number, number]];
  }, [done, puzzle, started, isInPath, isAdjacent, isWallBetween, getNextRequiredCheckpoint]);

  const checkWin = useCallback(async (currentPath: [number, number][]) => {
    if (currentPath.length === puzzle.size * puzzle.size) {
      // Verify all checkpoints are hit in order
      setDone(true);
      clearInterval(timerRef.current);
      const time = Math.floor((Date.now() - (startTime ?? Date.now())) / 1000);
      const score = Math.max(1, Math.round(settings.labyrinth_max_points / (1 + time / settings.labyrinth_time_param)));
      await submitScore.mutateAsync({
        game_id: GAME_ID,
        player_name: playerName,
        device_id: deviceId,
        score,
        round_id: roundId,
        meta: { time_seconds: time },
      });
    }
  }, [puzzle, startTime, settings, playerName, deviceId, submitScore, roundId]);

  const schedulePathRender = useCallback((nextPath: [number, number][]) => {
    pathRef.current = nextPath;
    pendingPathRef.current = nextPath;

    if (frameRef.current != null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setPath(pendingPathRef.current);
    });
  }, []);

  const handleCellClick = useCallback((r: number, c: number) => {
    if (done) return;
    const currentPath = pathRef.current;
    // If tapping the last cell in path, undo
    if (currentPath.length > 0) {
      const last = currentPath[currentPath.length - 1];
      if (last[0] === r && last[1] === c && currentPath.length > 1) {
        schedulePathRender(currentPath.slice(0, -1));
        return;
      }
    }
    const newPath = tryAddCell(r, c, currentPath);
    if (newPath !== currentPath) {
      schedulePathRender(newPath);
      checkWin(newPath);
    }
  }, [done, tryAddCell, checkWin, schedulePathRender]);

  const undoLast = useCallback(() => {
    const currentPath = pathRef.current;
    if (currentPath.length > 1) {
      schedulePathRender(currentPath.slice(0, -1));
    } else if (currentPath.length === 1) {
      schedulePathRender([]);
    }
  }, [schedulePathRender]);

  const restartPuzzle = useCallback(() => {
    schedulePathRender([]);
    setStarted(false);
    setDone(false);
    setError(false);
    isDragging.current = false;
    activePointerIdRef.current = null;
    lastPointerCellRef.current = null;
    gridMetricsRef.current = null;
  }, [schedulePathRender]);

  const trimPathToCell = useCallback((r: number, c: number, currentPath: [number, number][]) => {
    const existingIndex = currentPath.findIndex(([pr, pc]) => pr === r && pc === c);
    if (existingIndex === -1) return null;
    return currentPath.slice(0, existingIndex + 1);
  }, []);

  const isLastPathCell = useCallback((r: number, c: number, currentPath: [number, number][]) => {
    if (currentPath.length === 0) return false;
    const last = currentPath[currentPath.length - 1];
    return last[0] === r && last[1] === c;
  }, []);

  const updateGridMetrics = useCallback(() => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const metrics = {
      left: rect.left,
      top: rect.top,
      cellW: rect.width / puzzle.size,
      cellH: rect.height / puzzle.size,
    };
    gridMetricsRef.current = metrics;
    return metrics;
  }, [puzzle.size]);

  const getCellFromPoint = useCallback((clientX: number, clientY: number): [number, number] | null => {
    const metrics = gridMetricsRef.current ?? updateGridMetrics();
    if (!metrics) return null;
    const c = Math.floor((clientX - metrics.left) / metrics.cellW);
    const r = Math.floor((clientY - metrics.top) / metrics.cellH);
    if (r < 0 || r >= puzzle.size || c < 0 || c >= puzzle.size) return null;
    return [r, c];
  }, [puzzle.size, updateGridMetrics]);

  const applyCellToPath = useCallback((r: number, c: number) => {
    const currentPath = pathRef.current;
    const trimmedPath = trimPathToCell(r, c, currentPath);
    if (trimmedPath && trimmedPath.length !== currentPath.length) {
      schedulePathRender(trimmedPath);
      return;
    }

    if (isLastPathCell(r, c, currentPath)) return;

    const nextPath = tryAddCell(r, c, currentPath);
    if (nextPath !== currentPath) {
      schedulePathRender(nextPath);
      checkWin(nextPath);
    }
  }, [trimPathToCell, schedulePathRender, isLastPathCell, tryAddCell, checkWin]);

  const interpolateCells = useCallback((from: [number, number], to: [number, number]) => {
    const cells: [number, number][] = [];
    let [r, c] = from;

    while (r !== to[0] || c !== to[1]) {
      const rowDelta = to[0] - r;
      const colDelta = to[1] - c;

      if (Math.abs(colDelta) > Math.abs(rowDelta)) {
        c += Math.sign(colDelta);
      } else if (rowDelta !== 0) {
        r += Math.sign(rowDelta);
      } else {
        c += Math.sign(colDelta);
      }

      cells.push([r, c]);
    }

    return cells;
  }, []);

  const processPointerCell = useCallback((cell: [number, number]) => {
    const previousCell = lastPointerCellRef.current;
    if (!previousCell) {
      applyCellToPath(cell[0], cell[1]);
      lastPointerCellRef.current = cell;
      return;
    }

    if (previousCell[0] === cell[0] && previousCell[1] === cell[1]) return;

    for (const [r, c] of interpolateCells(previousCell, cell)) {
      applyCellToPath(r, c);
    }

    lastPointerCellRef.current = cell;
  }, [applyCellToPath, interpolateCells]);

  const stopDragging = useCallback((pointerId?: number) => {
    if (pointerId != null && activePointerIdRef.current != null && activePointerIdRef.current !== pointerId) {
      return;
    }

    isDragging.current = false;
    activePointerIdRef.current = null;
    lastPointerCellRef.current = null;
    gridMetricsRef.current = null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (done) return;
    e.preventDefault();
    updateGridMetrics();
    isDragging.current = true;
    activePointerIdRef.current = e.pointerId;
    lastPointerCellRef.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);

    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (cell) {
      processPointerCell(cell);
    }
  }, [done, updateGridMetrics, getCellFromPoint, processPointerCell]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || activePointerIdRef.current !== e.pointerId) return;
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (cell) {
      processPointerCell(cell);
    }
  }, [getCellFromPoint, processPointerCell]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    stopDragging(e.pointerId);
  }, [stopDragging]);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    stopDragging(e.pointerId);
  }, [stopDragging]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Build path index for quick lookup
  const pathIndex = useMemo(() => {
    const map = new Map<string, number>();
    path.forEach(([r, c], i) => map.set(`${r}-${c}`, i));
    return map;
  }, [path]);

  if (todayScore) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">🌀 Zip</CardTitle></CardHeader>
        <CardContent className="text-center py-6 space-y-2">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
          <p className="font-medium">{todayScore.score} pts</p>
          <p className="text-xs text-muted-foreground">
            {formatTime((todayScore.meta as any)?.time_seconds ?? 0)}
          </p>
        </CardContent>
      </Card>
    );
  }

  const cellSize = isMobile
    ? `min(calc((100vw - 0.5rem) / ${puzzle.size}), calc((100vh - 13rem) / ${puzzle.size}), 5rem)`
    : `min(calc((100vw - 3rem) / ${puzzle.size}), calc((100vh - 13rem) / ${puzzle.size}), 4rem)`;

  // Determine path connection lines
  const getPathConnections = (r: number, c: number) => {
    const idx = pathIndex.get(`${r}-${c}`);
    if (idx === undefined) return { top: false, bottom: false, left: false, right: false };
    const connections = { top: false, bottom: false, left: false, right: false };
    const check = (di: number, dr: number, dc: number, dir: 'top' | 'bottom' | 'left' | 'right') => {
      const ni = idx + di;
      if (ni >= 0 && ni < path.length) {
        const [nr, nc] = path[ni];
        if (nr === r + dr && nc === c + dc) connections[dir] = true;
      }
    };
    check(-1, -1, 0, 'top'); check(1, -1, 0, 'top');
    check(-1, 1, 0, 'bottom'); check(1, 1, 0, 'bottom');
    check(-1, 0, -1, 'left'); check(1, 0, -1, 'left');
    check(-1, 0, 1, 'right'); check(1, 0, 1, 'right');
    return connections;
  };

  // Color gradient along path progress
  const getPathColor = (idx: number) => {
    const t = path.length <= 1 ? 0 : idx / (path.length - 1);
    // Orange → Coral → Pink gradient
    const h = Math.round(25 - t * 30); // 25 (orange) → -5 (pink/rose)
    const s = Math.round(85 + t * 10);
    const l = Math.round(60 + t * 5);
    return `hsl(${h < 0 ? h + 360 : h}, ${s}%, ${l}%)`;
  };

  const progress = path.length;
  const total = puzzle.size * puzzle.size;

  return (
    <Card className={error ? 'ring-2 ring-destructive/50 transition-all' : 'transition-all'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">🌀 Zip</CardTitle>
          <div className="flex items-center gap-1">
            <button
              onClick={undoLast}
              className="flex items-center gap-1 text-xs text-muted-foreground active:text-foreground transition-colors p-1.5 rounded-lg"
              disabled={path.length === 0}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
            <button
              onClick={restartPuzzle}
              className="flex items-center gap-1 text-xs text-muted-foreground active:text-foreground transition-colors p-1.5 rounded-lg"
              disabled={path.length === 0}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(elapsed)}</span>
          <span>{progress}/{total} cells</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Draw a path from ① through every cell. Tap or drag to draw.
        </p>
      </CardHeader>
      <CardContent className={isMobile ? 'px-0' : 'px-4'}>
        <div className="flex flex-col items-center gap-3">
          <div
            ref={gridRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className="inline-grid gap-0 rounded-2xl overflow-hidden touch-none w-fit select-none"
            style={{
              gridTemplateColumns: `repeat(${puzzle.size}, ${cellSize})`,
              backgroundColor: 'hsl(var(--muted))',
              padding: '2px',
              touchAction: 'none',
            }}
          >
            {Array.from({ length: puzzle.size }, (_, ri) =>
              Array.from({ length: puzzle.size }, (_, ci) => {
                const cp = puzzle.checkpoints[ri][ci];
                const pathIdx = pathIndex.get(`${ri}-${ci}`);
                const isOnPath = pathIdx !== undefined;
                const isHead = isOnPath && pathIdx === path.length - 1;
                const conns = getPathConnections(ri, ci);
                const cellColor = isOnPath ? getPathColor(pathIdx!) : undefined;

                // Rounded corners: round outer corners of path ends/turns
                const roundTL = isOnPath && !conns.top && !conns.left;
                const roundTR = isOnPath && !conns.top && !conns.right;
                const roundBL = isOnPath && !conns.bottom && !conns.left;
                const roundBR = isOnPath && !conns.bottom && !conns.right;
                const borderRadius = `${roundTL ? '40%' : '0'} ${roundTR ? '40%' : '0'} ${roundBR ? '40%' : '0'} ${roundBL ? '40%' : '0'}`;

                return (
                  <div
                    key={`${ri}-${ci}`}
                    style={{ width: cellSize, height: cellSize, position: 'relative' }}
                    className="flex items-center justify-center cursor-pointer border-border/40"
                  >
                    {/* Path fill with organic rounding */}
                    {isOnPath && (
                      <div
                        className="absolute inset-[1px]"
                        style={{
                          backgroundColor: cellColor,
                          borderRadius,
                        }}
                      />
                    )}
                    {/* Connection fills to blend cells */}
                    {isOnPath && conns.top && (
                      <div className="absolute -top-[1px] left-[1px] right-[1px] h-[calc(50%+2px)]" style={{ backgroundColor: cellColor }} />
                    )}
                    {isOnPath && conns.bottom && (
                      <div className="absolute -bottom-[1px] left-[1px] right-[1px] h-[calc(50%+2px)]" style={{ backgroundColor: cellColor }} />
                    )}
                    {isOnPath && conns.left && (
                      <div className="absolute top-[1px] -left-[1px] bottom-[1px] w-[calc(50%+2px)]" style={{ backgroundColor: cellColor }} />
                    )}
                    {isOnPath && conns.right && (
                      <div className="absolute top-[1px] -right-[1px] bottom-[1px] w-[calc(50%+2px)]" style={{ backgroundColor: cellColor }} />
                    )}

                    {/* Wall indicators */}
                    {puzzle.walls.has(wallKey(ri, ci, ri, ci + 1)) && ci < puzzle.size - 1 && (
                      <div className="absolute right-0 top-[10%] bottom-[10%] w-[3px] bg-foreground/70 rounded-full z-20" />
                    )}
                    {puzzle.walls.has(wallKey(ri, ci, ri + 1, ci)) && ri < puzzle.size - 1 && (
                      <div className="absolute bottom-0 left-[10%] right-[10%] h-[3px] bg-foreground/70 rounded-full z-20" />
                    )}

                    {/* Checkpoint badge */}
                    {cp > 0 && (
                      <span className={`relative z-10 font-bold text-sm rounded-full w-7 h-7 flex items-center justify-center shadow-sm
                        ${isOnPath ? 'bg-white text-primary' : 'bg-white/90 text-primary/70 border border-primary/20'}
                      `}>
                        {cp}
                      </span>
                    )}

                    {/* Head dot */}
                    {isHead && cp === 0 && (
                      <span className="relative z-10 w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {done && (
          <p className="text-center font-semibold text-primary mt-3">🎉 Puzzle complete!</p>
        )}
      </CardContent>
    </Card>
  );
}
