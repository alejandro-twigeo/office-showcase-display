import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { useUserGuesses } from "@/hooks/useGuesses";
import { useDeviceId } from "@/hooks/useDeviceId";
import { RefreshCw, MapPin, Target, Check, AlertCircle, Lock, Settings, Trophy, ZoomIn, ZoomOut, RotateCcw, Binoculars, Brain, Clock, Gamepad2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoundSchedule } from "@/hooks/useRoundSchedule";
import { supabase } from "@/integrations/supabase/client";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/difficulty";
import { fetchMapillaryRound } from "@/lib/mapillary";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useScoring, calculateScore, formatScoreDisplay, type DifficultyWeights, type ScoringSettings } from "@/hooks/useScoring";
import { MiniGamesSelector } from "./MiniGamesSelector";
import { useRounds } from "@/hooks/useRounds";
import L from "leaflet";
import { usePresenceCount } from "@/hooks/usePresenceCount";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface GuessMapProps {
  playerName: string;
  onActiveTabChange?: (tab: 'easy' | 'hard' | 'other') => void;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Pure Leaflet map */
function LeafletMap({
  onMapClick,
  markerPosition,
}: {
  onMapClick: (lat: number, lng: number) => void;
  markerPosition: { lat: number; lng: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (markerPosition) {
      if (markerRef.current) {
        markerRef.current.setLatLng([markerPosition.lat, markerPosition.lng]);
      } else {
        markerRef.current = L.marker([markerPosition.lat, markerPosition.lng]).addTo(mapRef.current);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [markerPosition]);

  return <div ref={containerRef} className="h-full w-full" />;
}

/** Zoomable image with pan support */
function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const zoomIn = () => setScale(s => Math.min(s + 0.5, 5));
  const zoomOut = () => setScale(s => Math.max(s - 0.5, 1));
  const reset = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    containerRef.current?.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setTranslate(t => ({ x: t.x + dx, y: t.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-40 lg:h-full overflow-hidden rounded-lg border bg-black touch-none select-none"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          style={{
            transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
          draggable={false}
        />
      </div>
      <div className="absolute top-1.5 right-1.5 flex gap-1">
        <Button variant="secondary" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm" onClick={zoomOut} disabled={scale <= 1}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm" onClick={reset} disabled={scale === 1}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm" onClick={zoomIn} disabled={scale >= 5}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** Single-difficulty guess panel */
function DifficultyGuessPanel({ difficulty, playerName, settings, onCreateRound, isCreating }: {
  difficulty: Difficulty;
  playerName: string;
  settings: ReturnType<typeof useScoring>['settings'];
  onCreateRound: (d: Difficulty) => void;
  isCreating: boolean;
}) {
  const deviceId = useDeviceId();
  const { activeLocation } = useActiveLocation(difficulty);
  const { userGuesses, submitGuess, remainingGuesses } = useUserGuesses(
    activeLocation?.id,
    playerName,
    deviceId,
    settings.max_guesses_per_challenge ?? undefined
  );
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(null);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (settings.max_guesses_per_challenge == null || remainingGuesses > 0) {
        setSelectedPosition({ lat, lng });
      }
    },
    [remainingGuesses, settings.max_guesses_per_challenge]
  );

  const handleSubmitGuess = () => {
    if (!selectedPosition || !activeLocation || !deviceId) return;
    const distance = calculateDistance(
      selectedPosition.lat, selectedPosition.lng,
      activeLocation.lat, activeLocation.lng
    );
    const guessNumber = userGuesses.length + 1;
    submitGuess.mutate(
      {
        location_id: activeLocation.id,
        device_id: deviceId,
        player_name: playerName,
        lat: selectedPosition.lat,
        lng: selectedPosition.lng,
        distance_km: distance,
        guess_number: guessNumber,
      },
      { onSuccess: () => setSelectedPosition(null) }
    );
  };

  const canGuess = settings.max_guesses_per_challenge == null || remainingGuesses > 0;

  if (!activeLocation) {
    return (
      <div className="text-center py-6">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-2">No active {DIFFICULTY_LABELS[difficulty]} location</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop: image left, map right. Mobile: stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Image */}
        {activeLocation.pano_id && (
          <div className="lg:h-[50vh] min-h-[10rem]">
            <ZoomableImage src={activeLocation.pano_id} alt="mystery" />
          </div>
        )}

        {/* Map */}
        {canGuess && (
          <div className="h-[240px] lg:h-[50vh] overflow-hidden rounded-lg border">
            <LeafletMap onMapClick={handleMapClick} markerPosition={selectedPosition} />
          </div>
        )}
      </div>

      {canGuess ? (
        <>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {selectedPosition ? (
              <span className="text-sm">
                {selectedPosition.lat.toFixed(4)}, {selectedPosition.lng.toFixed(4)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Tap the map to place your marker</span>
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Look at the image and place your guess on the map. The closer you are, the more points you get. You can keep trying to improve your score. Only your best score counts. The hard challenge gives extra points.
          </p>

          <Button
            onClick={handleSubmitGuess}
            disabled={!selectedPosition || submitGuess.isPending}
            className="w-full"
            size="sm"
          >
            {submitGuess.isPending ? "Submitting..." : "Submit Guess"}
          </Button>
        </>
      ) : (
        <div className="text-center py-4">
          <Check className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="text-sm font-medium">No more guesses!</p>
        </div>
      )}

      {userGuesses.length > 0 && (
        <div className="border-t pt-2 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Your guesses:</p>
          {userGuesses.map((guess, i) => {
            const score = calculateScore(guess.distance_km, guess.guess_number, settings);
            const attemptIdx = (guess.guess_number ?? 1) - 1;
            const multiplier = settings.attempt_multipliers[Math.min(attemptIdx, settings.attempt_multipliers.length - 1)];
            const distanceText = guess.distance_km < 1
              ? `${Math.round(guess.distance_km * 1000)} m away`
              : `${Math.round(guess.distance_km)} km away`;
            return (
              <div key={guess.id} className="text-xs bg-secondary/50 px-2 py-1.5 rounded space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium">#{i + 1}</span>
                  <span className="font-mono font-semibold text-accent">{score} pts</span>
                </div>
                <div className="text-muted-foreground">
                  {distanceText} · Attempt {guess.guess_number ?? 1}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GuessMap({ playerName, onActiveTabChange }: GuessMapProps) {
  const deviceId = useDeviceId();
  const onlineUsers = usePresenceCount("app", { deviceId });
  const { settings, updateSettings } = useScoring();
  const { schedule, updateSchedule } = useRoundSchedule();
  const creatingRef = useRef(false);
  const [isCreatingRound, setIsCreatingRound] = useState(false);
  const [passwordAction, setPasswordAction] = useState<{ type: 'new' } | null>(null);
  const [actionPassword, setActionPassword] = useState('');
  const [actionError, setActionError] = useState('');

  // Scoring popup state
  const [scoringOpen, setScoringOpen] = useState(false);
  const [scoringPassword, setScoringPassword] = useState('');
  const [scoringUnlocked, setScoringUnlocked] = useState(false);
  const [scoringError, setScoringError] = useState('');
  const [editDistParam, setEditDistParam] = useState(String(settings.distance_parameter));
  const [editMultipliers, setEditMultipliers] = useState(settings.attempt_multipliers.map(String));
  const [editWeights, setEditWeights] = useState<DifficultyWeights>(settings.difficulty_weights);
  const [editWordlePoints, setEditWordlePoints] = useState(String(settings.wordle_points));
  const [editWordleAttemptPoints, setEditWordleAttemptPoints] = useState(settings.wordle_attempt_points.map(String));

  // Mini game settings edit state
  const [editCityDistParam, setEditCityDistParam] = useState('200');
  const [editCityMaxAttempts, setEditCityMaxAttempts] = useState('3');
  const [editTotPtsPerQ, setEditTotPtsPerQ] = useState('5');
  const [editTotStreak, setEditTotStreak] = useState('0.2');
  const [editSudokuMax, setEditSudokuMax] = useState('100');
  const [editSudokuTime, setEditSudokuTime] = useState('300');
  const [editPairsMax, setEditPairsMax] = useState('100');
  const [editPairsTime, setEditPairsTime] = useState('120');
  const [editPairsMovePen, setEditPairsMovePen] = useState('2');
  const [editLabMax, setEditLabMax] = useState('100');
  const [editLabTime, setEditLabTime] = useState('60');
  const [editLabResetPen, setEditLabResetPen] = useState('5');

  const [plantDays, setPlantDays] = useState<number | null>(null);
  const [plantDaysLoading, setPlantDaysLoading] = useState(false);

  useEffect(() => {
    setEditDistParam(String(settings.distance_parameter));
    setEditMultipliers(settings.attempt_multipliers.map(String));
    setEditWeights(settings.difficulty_weights);
    setEditWordlePoints(String(settings.wordle_points));
    setEditWordleAttemptPoints(settings.wordle_attempt_points.map(String));
  }, [settings]);

  // Fetch mini game settings for edit
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('scoring_settings' as never)
        .select('city_guess_distance_param, city_guess_max_attempts, thisorthat_points_per_q, thisorthat_streak_bonus, sudoku_max_points, sudoku_time_param, pairs_max_points, pairs_time_param, pairs_move_penalty, labyrinth_max_points, labyrinth_time_param, labyrinth_reset_penalty')
        .eq('id', 1).single();
      if (data) {
        const d = data as any;
        setEditCityDistParam(String(d.city_guess_distance_param ?? 200));
        setEditCityMaxAttempts(String(d.city_guess_max_attempts ?? 3));
        setEditTotPtsPerQ(String(d.thisorthat_points_per_q ?? 5));
        setEditTotStreak(String(d.thisorthat_streak_bonus ?? 0.2));
        setEditSudokuMax(String(d.sudoku_max_points ?? 100));
        setEditSudokuTime(String(d.sudoku_time_param ?? 300));
        setEditPairsMax(String(d.pairs_max_points ?? 100));
        setEditPairsTime(String(d.pairs_time_param ?? 120));
        setEditPairsMovePen(String(d.pairs_move_penalty ?? 2));
        setEditLabMax(String(d.labyrinth_max_points ?? 100));
        setEditLabTime(String(d.labyrinth_time_param ?? 60));
        setEditLabResetPen(String(d.labyrinth_reset_penalty ?? 5));
      }
    })();
  }, [scoringOpen]);

  useEffect(() => {
    if (!scoringOpen) return;
    let active = true;

    const fetchPlantDays = async () => {
      setPlantDaysLoading(true);
      const { data, error } = await (supabase as any)
        .from("plants")
        .select("last_watered_at")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      setPlantDaysLoading(false);
      if (error) {
        console.error("Failed to fetch plant for scoring popup:", error);
        return;
      }

      const last = data?.last_watered_at ? new Date(data.last_watered_at) : null;
      if (!active) return;
      setPlantDays(last ? Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24)) : null);
    };

    fetchPlantDays();

    // subscribe to plant updates so the days counter refreshes when watered
    try {
      const ch = (supabase as any)
        .channel('public:plants:scoring')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'plants' }, () => {
          void fetchPlantDays();
        })
        .subscribe();

      return () => {
        active = false;
        try { ch.unsubscribe(); } catch (_) { /* noop */ }
      };
    } catch (e) {
      // if realtime subscription isn't available, just rely on the single fetch
      return () => { active = false; };
    }
  }, [scoringOpen]);

  const { createNewLocation: createEasy } = useActiveLocation(1);
  const { createNewLocation: createHard } = useActiveLocation(3);

  const createFullRound = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setIsCreatingRound(true);
    try {
      // Deactivate previous round
      await supabase
        .from('rounds' as any)
        .update({ is_active: false } as any)
        .eq('is_active', true);

      // Create new round
      const { data: newRound, error: roundErr } = await supabase
        .from('rounds' as any)
        .insert({ is_active: true } as any)
        .select()
        .single();
      if (roundErr || !newRound) throw roundErr ?? new Error('Failed to create round');
      const roundId = (newRound as any).id;

      // Fetch both images in parallel
      const [easyImage, hardImage] = await Promise.all([
        fetchMapillaryRound(1),
        fetchMapillaryRound(3),
      ]);

      // Deactivate old locations for both difficulties
      await Promise.all([
        supabase.from('locations').update({ is_active: false }).eq('is_active', true).eq('difficulty', 1),
        supabase.from('locations').update({ is_active: false }).eq('is_active', true).eq('difficulty', 3),
      ]);

      // Create both locations with round_id
      const { error: locErr } = await supabase.from('locations').insert([
        { lat: easyImage.lat, lng: easyImage.lng, pano_id: easyImage.thumb_url, difficulty: 1, is_active: true, round_id: roundId },
        { lat: hardImage.lat, lng: hardImage.lng, pano_id: hardImage.thumb_url, difficulty: 3, is_active: true, round_id: roundId },
      ]);
      if (locErr) throw locErr;
    } catch (err) {
      console.error("Round creation failed", err);
    } finally {
      creatingRef.current = false;
      setIsCreatingRound(false);
    }
  }, []);

  const handlePasswordConfirm = async () => {
    if (actionPassword !== '1234') { setActionError('Wrong password'); return; }
    if (passwordAction?.type === 'new') {
      void createFullRound();
    }
    setPasswordAction(null);
    setActionPassword('');
    setActionError('');
  };

  const handleScoringPasswordConfirm = () => {
    if (scoringPassword !== '5678') { setScoringError('Wrong password'); return; }
    setScoringUnlocked(true);
    setScoringError('');
  };

  const handleSaveScoringSettings = () => {
    const distParam = parseFloat(editDistParam);
    const multipliers = editMultipliers.map(Number);
    const wp = parseInt(editWordlePoints);
    const wap = editWordleAttemptPoints.map(Number);
    if (isNaN(distParam) || distParam <= 0 || multipliers.some(isNaN) || isNaN(wp) || wap.some(isNaN)) return;
    updateSettings.mutate({
      distance_parameter: distParam,
      attempt_multipliers: multipliers,
      difficulty_weights: editWeights,
      wordle_points: wp,
      wordle_attempt_points: wap,
    });
  };

  const [activeTab, setActiveTabInternal] = useState<'easy' | 'hard' | 'other'>('easy');
  const setActiveTab = (tab: 'easy' | 'hard' | 'other') => {
    setActiveTabInternal(tab);
    onActiveTabChange?.(tab);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Make Your Guess
        </CardTitle>
        <div className="flex items-center gap-2 mt-2">
          {/* Scoring settings */}
          <Popover open={scoringOpen} onOpenChange={(open) => {
            setScoringOpen(open);
            if (!open) { setScoringPassword(''); setScoringError(''); setScoringUnlocked(false); }
          }}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" title="Scoring settings">
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="end">
              {!scoringUnlocked ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scoring Settings</p>
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input type="password" placeholder="Password" value={scoringPassword}
                      onChange={(e) => { setScoringPassword(e.target.value); setScoringError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleScoringPasswordConfirm()}
                      className="flex-1 h-8 text-sm" />
                    <Button size="sm" onClick={handleScoringPasswordConfirm} className="h-8">Unlock</Button>
                  </div>
                  {scoringError && <p className="text-xs text-destructive">{scoringError}</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scoring Settings</p>
                  {/* Distance parameter */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Distance parameter</p>
                    <Input type="number" value={editDistParam} min={1}
                      onChange={(e) => setEditDistParam(e.target.value)} className="h-8 text-sm" />
                  </div>
                  {/* Attempt multipliers */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Attempt multipliers</p>
                    <div className="space-y-1">
                      {editMultipliers.map((val, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-16">Attempt {i + 1}</span>
                          <Input type="number" value={val} min={0} max={1} step={0.01}
                            onChange={(e) => { const next = [...editMultipliers]; next[i] = e.target.value; setEditMultipliers(next); }}
                            className="h-7 text-sm flex-1" />
                          <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(Number(val) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Difficulty weights */}
                  <div className="space-y-1.5 border-t pt-3">
                    <p className="text-xs font-medium">Difficulty weights</p>
                    <p className="text-xs text-muted-foreground">Multiplier for combined leaderboard</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-12">Easy</span>
                        <Input type="number" value={editWeights.easy} min={0} step={0.1}
                          onChange={(e) => setEditWeights(w => ({ ...w, easy: parseFloat(e.target.value) || 0 }))}
                          className="h-7 text-sm flex-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-12">Hard</span>
                        <Input type="number" value={editWeights.hard} min={0} step={0.1}
                          onChange={(e) => setEditWeights(w => ({ ...w, hard: parseFloat(e.target.value) || 0 }))}
                          className="h-7 text-sm flex-1" />
                      </div>
                    </div>
                  </div>
                  {/* Wordle scoring */}
                  <div className="space-y-1.5 border-t pt-3">
                    <p className="text-xs font-medium">Wordle — Points per attempt</p>
                    <p className="text-xs text-muted-foreground">More points for fewer attempts</p>
                    <div className="space-y-1">
                      {editWordleAttemptPoints.map((val, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-16">Attempt {i + 1}</span>
                          <Input type="number" value={val} min={0}
                            onChange={(e) => { const next = [...editWordleAttemptPoints]; next[i] = e.target.value; setEditWordleAttemptPoints(next); }}
                            className="h-7 text-sm flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right">{val} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" className="w-full h-8" onClick={handleSaveScoringSettings}
                    disabled={updateSettings.isPending}>
                    {updateSettings.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                  {updateSettings.isSuccess && (
                    <p className="text-xs text-center text-primary">Saved!</p>
                  )}
                  <div className="border-t pt-2">
                    <p className="text-xs text-muted-foreground text-center">
                      Days since last watered: {plantDaysLoading ? '…' : (plantDays == null ? 'unknown' : String(plantDays))}
                      <span className="ml-1 text-white/40">({onlineUsers})</span>
                    </p>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Round settings */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Round settings">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="end">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Manual Reset</p>
                <p className="text-xs text-muted-foreground">Creates both an Easy and Hard challenge</p>
                <Button variant="outline" size="sm" className="w-full h-8"
                  onClick={() => setPasswordAction({ type: 'new' })}
                  disabled={isCreatingRound}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isCreatingRound ? "animate-spin" : ""}`} />
                  New Round
                </Button>
                {passwordAction && (
                  <div className="space-y-2 border-t pt-2">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <Input type="password" placeholder="Password"
                        value={actionPassword}
                        onChange={(e) => { setActionPassword(e.target.value); setActionError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handlePasswordConfirm()}
                        className="flex-1 h-8 text-sm" />
                      <Button size="sm" onClick={handlePasswordConfirm} className="h-8">Start</Button>
                    </div>
                    {actionError && <p className="text-xs text-destructive">{actionError}</p>}
                  </div>
                )}

                {/* Daily Auto-Reset */}
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Daily Auto-Reset</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Enabled</span>
                    <Switch
                      checked={schedule?.enabled ?? false}
                      onCheckedChange={(checked) => updateSchedule.mutate({ enabled: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Stockholm time
                    </span>
                    <Select
                      value={String(schedule?.reset_hour ?? 8)}
                      onValueChange={(v) => updateSchedule.mutate({ reset_hour: parseInt(v) })}
                    >
                      <SelectTrigger className="w-24 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {String(i).padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {schedule?.last_auto_reset_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Last auto-reset: {new Date(schedule.last_auto_reset_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Geo-Easy / Geo-Hard / Other tabs */}
        <div className="flex items-center gap-1">
          <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-lg flex-1">
            <button onClick={() => setActiveTab('easy')}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'easy' ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50' : 'text-muted-foreground'
              }`}>
              <Binoculars className="h-4 w-4 text-green-500" /> Geo-Easy
            </button>
            <button onClick={() => setActiveTab('hard')}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'hard' ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50' : 'text-muted-foreground'
              }`}>
              <Brain className="h-4 w-4 text-red-500" /> Geo-Hard
            </button>
          </div>
          <button onClick={() => setActiveTab('other')}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all border ${
              activeTab === 'other' ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50' : 'text-muted-foreground border-transparent'
            }`}>
            <Gamepad2 className="h-4 w-4" /> Other
          </button>
        </div>

        {activeTab !== 'other' ? (
          <DifficultyGuessPanel
            key={activeTab}
            difficulty={activeTab === 'easy' ? 1 : 3}
            playerName={playerName}
            settings={settings}
            onCreateRound={() => {}}
            isCreating={isCreatingRound}
          />
        ) : (
          <MiniGamesSelector playerName={playerName} />
        )}
      </CardContent>
    </Card>
  );
}
