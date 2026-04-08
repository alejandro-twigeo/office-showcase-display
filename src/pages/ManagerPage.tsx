import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, ArrowLeft, Clock, RefreshCw, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useScoring, type DifficultyWeights } from '@/hooks/useScoring';
import { useRoundSchedule } from '@/hooks/useRoundSchedule';
import { useDeviceId } from '@/hooks/useDeviceId';
import { usePresenceCount } from '@/hooks/usePresenceCount';
import { LEADERBOARD_PLAYER_COUNT_KEY, SUDOKU_HINT_PENALTY_KEY, useGameIcons } from '@/hooks/useGameIcons';
import { fetchMapillaryRound } from '@/lib/mapillary';
import { UsageAnalytics } from '@/components/manager/UsageAnalytics';
import { useIsMobile } from '@/hooks/use-mobile';

const MINI_GAMES = [
  { id: 'geoguessr', name: 'GeoGuessr', emoji: '🎯' },
  { id: 'wordle', name: 'Wordle', emoji: '🟩' },
  { id: 'city_guess', name: 'City Guess', emoji: '🏙️' },
  { id: 'this_or_that', name: 'This or That', emoji: '⚖️' },
  { id: 'sudoku', name: 'Sudoku', emoji: '🔢' },
  { id: 'pairs', name: 'Pairs', emoji: '🃏' },
  { id: 'labyrinth', name: 'Labyrinth', emoji: '🌀' },
];

export default function ManagerPage() {
  const isMobileLayout = useIsMobile();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState({
    screenWidth: 0,
    screenHeight: 0,
    availWidth: 0,
    availHeight: 0,
    innerWidth: 0,
    innerHeight: 0,
    outerWidth: 0,
    outerHeight: 0,
    clientWidth: 0,
    clientHeight: 0,
    devicePixelRatio: 1,
    visualViewportWidth: 0,
    visualViewportHeight: 0,
    visualViewportScale: 1,
    orientationType: '',
    orientationAngle: 0,
    appHeightVar: '',
    bottomNavHeight: 0,
    userAgentMobileMatch: false,
    userAgent: '',
  });

  const { settings, updateSettings } = useScoring();
  const { schedule, updateSchedule } = useRoundSchedule();
  const deviceId = useDeviceId();
  const onlineUsers = usePresenceCount('app', { deviceId });
  const { icons, uploadIcon, removeIcon } = useGameIcons();

  // Scoring edit state
  const [editDistParam, setEditDistParam] = useState('');
  const [editMultipliers, setEditMultipliers] = useState<string[]>([]);
  const [editWeights, setEditWeights] = useState<DifficultyWeights>({ easy: 1, hard: 1.2 });
  const [editWordlePoints, setEditWordlePoints] = useState('');
  const [editWordleAttemptPoints, setEditWordleAttemptPoints] = useState<string[]>([]);
  const [editMaxGuesses, setEditMaxGuesses] = useState<string>('');
  const [guessLimitEnabled, setGuessLimitEnabled] = useState(false);
  const [editLeaderboardPlayers, setEditLeaderboardPlayers] = useState('3');

  // Mini game settings
  const [editCityDistParam, setEditCityDistParam] = useState('200');
  const [editCityMaxAttempts, setEditCityMaxAttempts] = useState('3');
  const [editTotPtsPerQ, setEditTotPtsPerQ] = useState('5');
  const [editTotStreak, setEditTotStreak] = useState('0.2');
  const [editSudokuMax, setEditSudokuMax] = useState('100');
  const [editSudokuTime, setEditSudokuTime] = useState('300');
  const [editSudokuHintPenalty, setEditSudokuHintPenalty] = useState('15');
  const [editPairsMax, setEditPairsMax] = useState('100');
  const [editPairsTime, setEditPairsTime] = useState('120');
  const [editPairsMovePen, setEditPairsMovePen] = useState('2');
  const [editLabMax, setEditLabMax] = useState('100');
  const [editLabTime, setEditLabTime] = useState('60');
  const [editLabResetPen, setEditLabResetPen] = useState('5');

  // Round creation
  const [isCreatingRound, setIsCreatingRound] = useState(false);
  const creatingRef = useRef(false);

  // Plant days
  const [plantDays, setPlantDays] = useState<number | null>(null);

  useEffect(() => {
    setEditDistParam(String(settings.distance_parameter));
    setEditMultipliers(settings.attempt_multipliers.map(String));
    setEditWeights(settings.difficulty_weights);
    setEditWordlePoints(String(settings.wordle_points));
    setEditWordleAttemptPoints(settings.wordle_attempt_points.map(String));
    setGuessLimitEnabled(settings.max_guesses_per_challenge != null);
    setEditMaxGuesses(String(settings.max_guesses_per_challenge ?? 5));
  }, [settings]);

  useEffect(() => {
    const updateDebugInfo = () => {
      if (typeof window === 'undefined') return;
      setDebugInfo({
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        visualViewportWidth: window.visualViewport?.width ?? 0,
        visualViewportHeight: window.visualViewport?.height ?? 0,
        visualViewportScale: window.visualViewport?.scale ?? 1,
        orientationType: window.screen.orientation?.type ?? '',
        orientationAngle: window.screen.orientation?.angle ?? 0,
        appHeightVar: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
        bottomNavHeight: document.querySelector('nav')?.getBoundingClientRect().height ?? 0,
        userAgentMobileMatch: /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
        userAgent: navigator.userAgent,
      });
    };

    updateDebugInfo();
    window.addEventListener('resize', updateDebugInfo);
    window.visualViewport?.addEventListener('resize', updateDebugInfo);
    return () => {
      window.removeEventListener('resize', updateDebugInfo);
      window.visualViewport?.removeEventListener('resize', updateDebugInfo);
    };
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      const { data } = await supabase.from('scoring_settings' as never)
        .select('city_guess_distance_param, city_guess_max_attempts, thisorthat_points_per_q, thisorthat_streak_bonus, sudoku_max_points, sudoku_time_param, pairs_max_points, pairs_time_param, pairs_move_penalty, labyrinth_max_points, labyrinth_time_param, labyrinth_reset_penalty, game_icons')
        .eq('id', 1).single();
      if (data) {
        const d = data as any;
        setEditCityDistParam(String(d.city_guess_distance_param ?? 200));
        setEditCityMaxAttempts(String(d.city_guess_max_attempts ?? 3));
        setEditTotPtsPerQ(String(d.thisorthat_points_per_q ?? 5));
        setEditTotStreak(String(d.thisorthat_streak_bonus ?? 0.2));
        setEditSudokuMax(String(d.sudoku_max_points ?? 100));
        setEditSudokuTime(String(d.sudoku_time_param ?? 300));
        setEditSudokuHintPenalty(String(d.game_icons?.[SUDOKU_HINT_PENALTY_KEY] ?? 15));
        setEditPairsMax(String(d.pairs_max_points ?? 100));
        setEditPairsTime(String(d.pairs_time_param ?? 120));
        setEditPairsMovePen(String(d.pairs_move_penalty ?? 2));
        setEditLabMax(String(d.labyrinth_max_points ?? 100));
        setEditLabTime(String(d.labyrinth_time_param ?? 60));
        setEditLabResetPen(String(d.labyrinth_reset_penalty ?? 5));
        setEditLeaderboardPlayers(String(d.game_icons?.[LEADERBOARD_PLAYER_COUNT_KEY] ?? 3));
      }
    })();

    // Fetch plant days
    (async () => {
      const { data } = await (supabase as any)
        .from('plants')
        .select('last_watered_at')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const last = data?.last_watered_at ? new Date(data.last_watered_at) : null;
      setPlantDays(last ? Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24)) : null);
    })();
  }, [unlocked]);

  const handleUnlock = () => {
    if (password !== '5678') { setError('Wrong password'); return; }
    setUnlocked(true);
    setError('');
  };

  const handleSave = async () => {
    const distParam = parseFloat(editDistParam);
    const multipliers = editMultipliers.map(Number);
    const wp = parseInt(editWordlePoints);
    const wap = editWordleAttemptPoints.map(Number);
    const leaderboardPlayers = parseInt(editLeaderboardPlayers);
    const sudokuHintPenalty = parseInt(editSudokuHintPenalty);
    if (isNaN(distParam) || distParam <= 0 || multipliers.some(isNaN) || isNaN(wp) || wap.some(isNaN) || isNaN(leaderboardPlayers) || leaderboardPlayers < 1 || isNaN(sudokuHintPenalty) || sudokuHintPenalty < 0) return;
    const maxGuesses = guessLimitEnabled ? parseInt(editMaxGuesses) || 5 : null;
    updateSettings.mutate({
      distance_parameter: distParam,
      attempt_multipliers: multipliers,
      difficulty_weights: editWeights,
      max_guesses_per_challenge: maxGuesses,
      wordle_points: wp,
      wordle_attempt_points: wap,
    });
    const { data: existingSettings } = await supabase
      .from('scoring_settings' as never)
      .select('game_icons')
      .eq('id', 1)
      .single();
    const existingGameIcons = ((existingSettings as any)?.game_icons ?? {}) as Record<string, unknown>;
    await supabase.from('scoring_settings' as never).update({
      city_guess_distance_param: parseFloat(editCityDistParam),
      city_guess_max_attempts: parseInt(editCityMaxAttempts),
      thisorthat_points_per_q: parseInt(editTotPtsPerQ),
      thisorthat_streak_bonus: parseFloat(editTotStreak),
      sudoku_max_points: parseInt(editSudokuMax),
      sudoku_time_param: parseInt(editSudokuTime),
      pairs_max_points: parseInt(editPairsMax),
      pairs_time_param: parseInt(editPairsTime),
      pairs_move_penalty: parseInt(editPairsMovePen),
      labyrinth_max_points: parseInt(editLabMax),
      labyrinth_time_param: parseInt(editLabTime),
      labyrinth_reset_penalty: parseInt(editLabResetPen),
      game_icons: {
        ...existingGameIcons,
        [LEADERBOARD_PLAYER_COUNT_KEY]: leaderboardPlayers,
        [SUDOKU_HINT_PENALTY_KEY]: sudokuHintPenalty,
      },
    } as never).eq('id', 1);
  };

  const createFullRound = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setIsCreatingRound(true);
    try {
      await supabase.from('rounds' as any).update({ is_active: false } as any).eq('is_active', true);
      const { data: newRound, error: roundErr } = await supabase.from('rounds' as any).insert({ is_active: true } as any).select().single();
      if (roundErr || !newRound) throw roundErr;
      const roundId = (newRound as any).id;
      const [easyImage, hardImage] = await Promise.all([fetchMapillaryRound(1), fetchMapillaryRound(3)]);
      await Promise.all([
        supabase.from('locations').update({ is_active: false }).eq('is_active', true).eq('difficulty', 1),
        supabase.from('locations').update({ is_active: false }).eq('is_active', true).eq('difficulty', 3),
      ]);
      await supabase.from('locations').insert([
        { lat: easyImage.lat, lng: easyImage.lng, pano_id: easyImage.thumb_url, difficulty: 1, is_active: true, round_id: roundId },
        { lat: hardImage.lat, lng: hardImage.lng, pano_id: hardImage.thumb_url, difficulty: 3, is_active: true, round_id: roundId },
      ]);
    } catch (err) {
      console.error('Round creation failed', err);
    } finally {
      creatingRef.current = false;
      setIsCreatingRound(false);
    }
  };

  const handleIconUpload = async (gameId: string, file: File) => {
    try {
      await uploadIcon(gameId, file);
    } catch (e) {
      console.error('Icon upload failed', e);
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Manager Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/play')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button className="flex-1" onClick={handleUnlock}>Unlock</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/play')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Play
          </Button>
          <h1 className="text-lg font-semibold">Manager</h1>
          <span className="text-xs text-muted-foreground">{onlineUsers} online</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Game Icons */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Game Icons</CardTitle>
            <p className="text-xs text-muted-foreground">Upload custom images for each mini game (replaces emoji)</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {MINI_GAMES.map((game) => (
                <div key={game.id} className="flex flex-col items-center gap-1.5">
                  <div className="relative w-12 h-12 rounded-xl border bg-secondary/30 flex items-center justify-center overflow-hidden">
                    {icons[game.id] ? (
                      <>
                        <img src={icons[game.id]} alt={game.name} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeIcon(game.id)}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-xl">{game.emoji}</span>
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-center leading-tight">{game.name}</p>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleIconUpload(game.id, file);
                        e.target.value = '';
                      }}
                    />
                    <span className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                      <Upload className="h-2.5 w-2.5" /> Upload
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scoring Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Scoring Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* GeoGuessr */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">GeoGuessr</p>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium">Distance parameter</p>
                  <Input type="number" value={editDistParam} min={1} onChange={(e) => setEditDistParam(e.target.value)} className="h-7 text-sm" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium">Attempt multipliers</p>
                  {editMultipliers.map((val, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground w-8">#{i + 1}</span>
                      <Input type="number" value={val} min={0} max={1} step={0.01} onChange={(e) => { const n = [...editMultipliers]; n[i] = e.target.value; setEditMultipliers(n); }} className="h-6 text-xs flex-1" />
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium">Difficulty weights</p>
                  {(['easy', 'hard'] as const).map((d) => (
                    <div key={d} className="flex items-center gap-1">
                      <span className="text-xs w-8 capitalize">{d}</span>
                      <Input type="number" value={editWeights[d]} min={0} step={0.1} onChange={(e) => setEditWeights(w => ({ ...w, [d]: parseFloat(e.target.value) || 0 }))} className="h-6 text-xs flex-1" />
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">Guess limit</p>
                    <Switch checked={guessLimitEnabled} onCheckedChange={setGuessLimitEnabled} />
                  </div>
                  {guessLimitEnabled && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground w-14">Max</span>
                      <Input type="number" value={editMaxGuesses} min={1} max={20} onChange={(e) => setEditMaxGuesses(e.target.value)} className="h-6 text-xs flex-1" />
                    </div>
                  )}
                </div>
              </div>

              {/* Wordle */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Wordle</p>
                <div className="space-y-1">
                  <p className="text-xs font-medium">Points per attempt</p>
                  {editWordleAttemptPoints.map((val, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground w-8">#{i + 1}</span>
                      <Input type="number" value={val} min={0} onChange={(e) => { const n = [...editWordleAttemptPoints]; n[i] = e.target.value; setEditWordleAttemptPoints(n); }} className="h-6 text-xs flex-1" />
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium">Leaderboard players shown</p>
                  <Input type="number" value={editLeaderboardPlayers} min={1} max={20} onChange={(e) => setEditLeaderboardPlayers(e.target.value)} className="h-7 text-sm" />
                </div>
              </div>
            </div>

            {/* Mini Game Settings */}
            <div className="border-t mt-4 pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Mini Game Settings</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium">🏙️ City Guess</p>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Dist</span><Input type="number" value={editCityDistParam} onChange={(e) => setEditCityDistParam(e.target.value)} className="h-6 text-xs flex-1" /></div>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Max tries</span><Input type="number" value={editCityMaxAttempts} onChange={(e) => setEditCityMaxAttempts(e.target.value)} className="h-6 text-xs flex-1" /></div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium">⚖️ This or That</p>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Pts/Q</span><Input type="number" value={editTotPtsPerQ} onChange={(e) => setEditTotPtsPerQ(e.target.value)} className="h-6 text-xs flex-1" /></div>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Streak</span><Input type="number" value={editTotStreak} step={0.05} onChange={(e) => setEditTotStreak(e.target.value)} className="h-6 text-xs flex-1" /></div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium">🔢 Sudoku</p>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Max pts</span><Input type="number" value={editSudokuMax} onChange={(e) => setEditSudokuMax(e.target.value)} className="h-6 text-xs flex-1" /></div>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Time</span><Input type="number" value={editSudokuTime} onChange={(e) => setEditSudokuTime(e.target.value)} className="h-6 text-xs flex-1" /></div>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Hint pen</span><Input type="number" value={editSudokuHintPenalty} min={0} onChange={(e) => setEditSudokuHintPenalty(e.target.value)} className="h-6 text-xs flex-1" /></div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium">🃏 Pairs</p>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Max pts</span><Input type="number" value={editPairsMax} onChange={(e) => setEditPairsMax(e.target.value)} className="h-6 text-xs flex-1" /></div>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Time</span><Input type="number" value={editPairsTime} onChange={(e) => setEditPairsTime(e.target.value)} className="h-6 text-xs flex-1" /></div>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Move pen</span><Input type="number" value={editPairsMovePen} onChange={(e) => setEditPairsMovePen(e.target.value)} className="h-6 text-xs flex-1" /></div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium">🌀 Labyrinth</p>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Max pts</span><Input type="number" value={editLabMax} onChange={(e) => setEditLabMax(e.target.value)} className="h-6 text-xs flex-1" /></div>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Time</span><Input type="number" value={editLabTime} onChange={(e) => setEditLabTime(e.target.value)} className="h-6 text-xs flex-1" /></div>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground w-14">Reset pen</span><Input type="number" value={editLabResetPen} onChange={(e) => setEditLabResetPen(e.target.value)} className="h-6 text-xs flex-1" /></div>
                </div>
              </div>
            </div>

            <Button size="sm" className="w-full mt-4" onClick={handleSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? 'Saving…' : 'Save Scoring Settings'}
            </Button>
            {updateSettings.isSuccess && <p className="text-xs text-center text-primary mt-1">Saved!</p>}
          </CardContent>
        </Card>

        {/* Round Management */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Round Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" size="sm" className="w-full" onClick={createFullRound} disabled={isCreatingRound}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isCreatingRound ? 'animate-spin' : ''}`} />
              New Round (All Games)
            </Button>

            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Daily Auto-Reset</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Enabled</span>
                <Switch checked={schedule?.enabled ?? false} onCheckedChange={(c) => updateSchedule.mutate({ enabled: c })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Stockholm time</span>
                <Select value={String(schedule?.reset_hour ?? 8)} onValueChange={(v) => updateSchedule.mutate({ reset_hour: parseInt(v) })}>
                  <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {schedule?.last_auto_reset_at && (
                <p className="text-[10px] text-muted-foreground">Last: {new Date(schedule.last_auto_reset_at).toLocaleString()}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Analytics */}
        <UsageAnalytics />

        {/* Device Debug */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Device Debug</CardTitle>
            <p className="text-xs text-muted-foreground">Use this on the phone to confirm the live layout inputs.</p>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">screen</p>
                <p className="font-mono">{debugInfo.screenWidth} × {debugInfo.screenHeight}</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">screen avail</p>
                <p className="font-mono">{debugInfo.availWidth} × {debugInfo.availHeight}</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">Mobile Layout</p>
                <p className="font-mono">{String(isMobileLayout)}</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">UA Mobile Match</p>
                <p className="font-mono">{String(debugInfo.userAgentMobileMatch)}</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">Device Pixel Ratio</p>
                <p className="font-mono">{debugInfo.devicePixelRatio}</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">window.inner</p>
                <p className="font-mono">{debugInfo.innerWidth} × {debugInfo.innerHeight}</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">window.outer</p>
                <p className="font-mono">{debugInfo.outerWidth} × {debugInfo.outerHeight}</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">documentElement</p>
                <p className="font-mono">{debugInfo.clientWidth} × {debugInfo.clientHeight}</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">visualViewport</p>
                <p className="font-mono">{Math.round(debugInfo.visualViewportWidth)} × {Math.round(debugInfo.visualViewportHeight)}</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">visualViewport scale</p>
                <p className="font-mono">{debugInfo.visualViewportScale}</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">Orientation</p>
                <p className="font-mono">{debugInfo.orientationType || 'unknown'} · {debugInfo.orientationAngle}°</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">--app-height</p>
                <p className="font-mono">{debugInfo.appHeightVar || 'unset'}</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">Bottom Nav Height</p>
                <p className="font-mono">{Math.round(debugInfo.bottomNavHeight)}px</p>
              </div>
              <div className="rounded border bg-secondary/20 p-2">
                <p className="text-muted-foreground">Build Marker</p>
                <p className="font-mono">mobile-debug-2026-04-08-2</p>
              </div>
            </div>
            <div className="rounded border bg-secondary/20 p-2">
              <p className="text-muted-foreground mb-1">User Agent</p>
              <p className="font-mono break-all leading-snug">{debugInfo.userAgent}</p>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center">
          Days since last watered: {plantDays == null ? 'unknown' : plantDays} · {onlineUsers} online
        </p>
      </main>
    </div>
  );
}
