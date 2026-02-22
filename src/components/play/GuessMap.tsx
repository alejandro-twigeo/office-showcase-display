import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { useUserGuesses } from "@/hooks/useGuesses";
import { useDeviceId } from "@/hooks/useDeviceId";
import { RefreshCw, MapPin, Target, Check, AlertCircle, Lock, Settings, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/difficulty";
import { fetchMapillaryRound } from "@/lib/mapillary";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useScoring, calculateScore, formatScoreDisplay, type DifficultyWeights } from "@/hooks/useScoring";
import L from "leaflet";
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
      {/* Image preview */}
      {activeLocation.pano_id && (
        <div className="w-full h-32 overflow-hidden rounded-lg border bg-black">
          <img src={activeLocation.pano_id} alt="mystery" className="w-full h-full object-cover" />
        </div>
      )}

      {canGuess ? (
        <>
          <div className="w-full h-[240px] overflow-hidden rounded-lg border">
            <LeafletMap onMapClick={handleMapClick} markerPosition={selectedPosition} />
          </div>

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
            const baseScore = Math.round(1000 * Math.exp(-guess.distance_km / settings.distance_parameter));
            return (
              <div key={guess.id} className="text-xs bg-secondary/50 px-2 py-1.5 rounded space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium">#{i + 1}</span>
                  <span className="font-mono font-semibold text-accent">{score} pts</span>
                </div>
                <div className="text-muted-foreground">
                  {guess.distance_km < 1
                    ? `${Math.round(guess.distance_km * 1000)}m`
                    : `${guess.distance_km.toFixed(1)}km`
                  } away · base {baseScore} × {Math.round(multiplier * 100)}% (attempt {guess.guess_number ?? 1}) = {score}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GuessMap({ playerName }: GuessMapProps) {
  const { settings, updateSettings } = useScoring();
  const creatingRef = useRef(false);
  const [isCreatingRound, setIsCreatingRound] = useState(false);
  const [creatingDifficulty, setCreatingDifficulty] = useState<Difficulty | null>(null);
  const [passwordAction, setPasswordAction] = useState<{ type: 'new'; difficulty: Difficulty } | null>(null);
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

  useEffect(() => {
    setEditDistParam(String(settings.distance_parameter));
    setEditMultipliers(settings.attempt_multipliers.map(String));
    setEditWeights(settings.difficulty_weights);
  }, [settings]);

  const { createNewLocation: createEasy } = useActiveLocation(1);
  const { createNewLocation: createHard } = useActiveLocation(3);

  const createRound = useCallback(async (difficulty: Difficulty) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setIsCreatingRound(true);
    setCreatingDifficulty(difficulty);
    try {
      const image = await fetchMapillaryRound(difficulty);
      const mutator = difficulty === 1 ? createEasy : createHard;
      mutator.mutate(
        { lat: image.lat, lng: image.lng, pano_id: image.thumb_url, difficulty },
        {
          onSuccess: () => { creatingRef.current = false; setIsCreatingRound(false); setCreatingDifficulty(null); },
          onError: () => { creatingRef.current = false; setIsCreatingRound(false); setCreatingDifficulty(null); },
        }
      );
    } catch (err) {
      console.error("Round creation failed", err);
      creatingRef.current = false;
      setIsCreatingRound(false);
      setCreatingDifficulty(null);
    }
  }, [createEasy, createHard]);

  const handlePasswordConfirm = async () => {
    if (actionPassword !== '1234') { setActionError('Wrong password'); return; }
    if (passwordAction?.type === 'new') {
      void createRound(passwordAction.difficulty);
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
    if (isNaN(distParam) || distParam <= 0 || multipliers.some(isNaN)) return;
    updateSettings.mutate({
      distance_parameter: distParam,
      attempt_multipliers: multipliers,
      difficulty_weights: editWeights,
    });
  };

  const [activeTab, setActiveTab] = useState<'easy' | 'hard'>('easy');

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
                  <Button size="sm" className="w-full h-8" onClick={handleSaveScoringSettings}
                    disabled={updateSettings.isPending}>
                    {updateSettings.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                  {updateSettings.isSuccess && (
                    <p className="text-xs text-center text-primary">Saved!</p>
                  )}
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
            <PopoverContent className="w-64 p-3" align="end">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Round</p>
                <div className="flex gap-2">
                  {([1, 3] as Difficulty[]).map((d) => (
                    <Button key={d} variant="outline" size="sm" className="flex-1 h-8"
                      onClick={() => setPasswordAction({ type: 'new', difficulty: d })}
                      disabled={isCreatingRound}>
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isCreatingRound && creatingDifficulty === d ? "animate-spin" : ""}`} />
                      New {DIFFICULTY_LABELS[d]}
                    </Button>
                  ))}
                </div>
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
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Easy / Hard tabs */}
        <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-lg">
          <button onClick={() => setActiveTab('easy')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === 'easy' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}>
            🟢 Easy
          </button>
          <button onClick={() => setActiveTab('hard')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === 'hard' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}>
            🔴 Hard
          </button>
        </div>

        <DifficultyGuessPanel
          key={activeTab}
          difficulty={activeTab === 'easy' ? 1 : 3}
          playerName={playerName}
          settings={settings}
          onCreateRound={createRound}
          isCreating={isCreatingRound}
        />
      </CardContent>
    </Card>
  );
}
