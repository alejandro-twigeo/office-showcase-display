import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { useUserGuesses } from "@/hooks/useGuesses";
import { useDeviceId } from "@/hooks/useDeviceId";
import { RefreshCw, MapPin, Target, Check, AlertCircle, ZoomOut, Lock, Settings, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DIFFICULTY_LOCATIONS, DIFFICULTY_LABELS, type Difficulty } from "@/lib/difficulty";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useScoring, calculateScore, formatScoreDisplay } from "@/hooks/useScoring";
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

/** Pure Leaflet map (no react-leaflet) to avoid Context.Consumer crash in React 18. */
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

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    // Fix tiles when container is initially 0×0 (inside tabs)
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // onMapClick is stable (useCallback) so this is fine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker
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

// Same zoom config as dashboard
const ZOOM_LEVELS = [6, 4.5, 3, 2, 1.5, 1];
const ZOOM_INTERVAL_MS = 30 * 60 * 1000;
const GUESSES_PER_ZOOM = 3;

function getZoomIndex(createdAt: string | null | undefined): number {
  if (!createdAt) return 0;
  const elapsed = Date.now() - new Date(createdAt).getTime();
  return Math.min(Math.floor(elapsed / ZOOM_INTERVAL_MS), ZOOM_LEVELS.length - 1);
}

export function GuessMap({ playerName }: GuessMapProps) {
  const deviceId = useDeviceId();
  const { activeLocation, createNewLocation } = useActiveLocation();
  const { settings, updateSettings } = useScoring();

  const creatingRef = useRef(false);
  const [isCreatingRound, setIsCreatingRound] = useState(false);
  const [passwordAction, setPasswordAction] = useState<'zoom' | 'new' | null>(null);
  const [actionPassword, setActionPassword] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(1);

  // Scoring popup state
  const [scoringOpen, setScoringOpen] = useState(false);
  const [scoringPassword, setScoringPassword] = useState('');
  const [scoringUnlocked, setScoringUnlocked] = useState(false);
  const [scoringError, setScoringError] = useState('');
  const [editDistParam, setEditDistParam] = useState(String(settings.distance_parameter));
  const [editMultipliers, setEditMultipliers] = useState(settings.attempt_multipliers.map(String));

  // Keep edit fields in sync when settings load from DB
  useEffect(() => {
    setEditDistParam(String(settings.distance_parameter));
    setEditMultipliers(settings.attempt_multipliers.map(String));
  }, [settings]);

  // Compute current zoom index & max guesses allowed so far
  const zoomIndex = getZoomIndex(activeLocation?.created_at);
  const maxTotalGuesses = (zoomIndex + 1) * GUESSES_PER_ZOOM;

  const createRound = useCallback(async (difficulty: Difficulty) => {
    if (creatingRef.current || createNewLocation.isPending) return;
    creatingRef.current = true;
    setIsCreatingRound(true);
    try {
      const titles = DIFFICULTY_LOCATIONS[difficulty];
      const title = titles[Math.floor(Math.random() * titles.length)];
      const res = await fetch(
        "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=coordinates|pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=1280&titles=" +
          encodeURIComponent(title)
      );
      const data = await res.json();
      const pages = data?.query?.pages;
      const page = pages ? pages[Object.keys(pages)[0]] : null;
      const coord = page?.coordinates?.[0];
      const thumb = page?.thumbnail?.source;
      if (!coord || !thumb) throw new Error("No data");
      createNewLocation.mutate(
        { lat: coord.lat, lng: coord.lon, pano_id: thumb, difficulty },
        {
          onSuccess: () => { creatingRef.current = false; setIsCreatingRound(false); },
          onError: () => { creatingRef.current = false; setIsCreatingRound(false); },
        }
      );
    } catch {
      creatingRef.current = false;
      setIsCreatingRound(false);
    }
  }, [createNewLocation]);

  const handlePasswordConfirm = async () => {
    if (actionPassword !== '1234') {
      setActionError('Wrong password');
      return;
    }
    if (passwordAction === 'zoom') {
      if (!activeLocation?.created_at) return;
      const current = new Date(activeLocation.created_at);
      current.setMinutes(current.getMinutes() - 30);
      await supabase
        .from('locations')
        .update({ created_at: current.toISOString() })
        .eq('id', activeLocation.id);
    } else if (passwordAction === 'new') {
      void createRound(selectedDifficulty);
    }
    setPasswordAction(null);
    setActionPassword('');
    setActionError('');
  };

  const handleScoringPasswordConfirm = () => {
    if (scoringPassword !== '5678') {
      setScoringError('Wrong password');
      return;
    }
    setScoringUnlocked(true);
    setScoringError('');
  };

  const handleSaveScoringSettings = () => {
    const distParam = parseFloat(editDistParam);
    const multipliers = editMultipliers.map(Number);
    if (isNaN(distParam) || distParam <= 0 || multipliers.some(isNaN)) return;
    updateSettings.mutate({ distance_parameter: distParam, attempt_multipliers: multipliers });
  };

  const { userGuesses, submitGuess, remainingGuesses } = useUserGuesses(
    activeLocation?.id,
    deviceId,
    maxTotalGuesses
  );

  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(null);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (remainingGuesses > 0) setSelectedPosition({ lat, lng });
    },
    [remainingGuesses]
  );

  const handleSubmitGuess = () => {
    if (!selectedPosition || !activeLocation || !deviceId) return;
    const distance = calculateDistance(
      selectedPosition.lat, selectedPosition.lng,
      activeLocation.lat, activeLocation.lng
    );
    const guessNumber = userGuesses.length + 1;
    const playerNameWithSuffix = `${playerName}_${guessNumber}`;
    submitGuess.mutate(
      {
        location_id: activeLocation.id,
        device_id: deviceId,
        player_name: playerNameWithSuffix,
        lat: selectedPosition.lat,
        lng: selectedPosition.lng,
        distance_km: distance,
        guess_number: guessNumber,
      },
      { onSuccess: () => setSelectedPosition(null) }
    );
  };

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
  };

  if (!activeLocation) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No active location to guess</p>
          <p className="text-sm text-muted-foreground mt-1">Wait for a new round to start on the TV</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Make Your Guess
        </CardTitle>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">
            {remainingGuesses} guess{remainingGuesses !== 1 ? "es" : ""} left
            <span className="ml-1">(zoom {zoomIndex + 1}/{ZOOM_LEVELS.length})</span>
          </span>

          {/* ── Scoring settings icon ─────────────────────────────── */}
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
                  <p className="text-xs text-muted-foreground">Enter the manager password to edit scoring.</p>
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={scoringPassword}
                      onChange={(e) => { setScoringPassword(e.target.value); setScoringError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleScoringPasswordConfirm()}
                      className="flex-1 h-8 text-sm"
                    />
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
                    <p className="text-xs text-muted-foreground">Higher = more forgiving (default 500)</p>
                    <Input
                      type="number"
                      value={editDistParam}
                      min={1}
                      onChange={(e) => setEditDistParam(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Attempt multipliers */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Attempt multipliers</p>
                    <p className="text-xs text-muted-foreground">% of points per attempt (1 = 100%)</p>
                    <div className="space-y-1">
                      {editMultipliers.map((val, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-20">
                            {i + 1 < editMultipliers.length ? `Attempt ${i + 1}` : `Attempt ${i + 1}+`}
                          </span>
                          <Input
                            type="number"
                            value={val}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={(e) => {
                              const next = [...editMultipliers];
                              next[i] = e.target.value;
                              setEditMultipliers(next);
                            }}
                            className="h-7 text-sm flex-1"
                          />
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {Math.round(Number(val) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="w-full h-8"
                    onClick={handleSaveScoringSettings}
                    disabled={updateSettings.isPending}
                  >
                    {updateSettings.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                  {updateSettings.isSuccess && (
                    <p className="text-xs text-center text-primary">Saved! Changes apply immediately.</p>
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* ── Round settings icon ───────────────────────────────── */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Round settings">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Round Settings</p>

                {/* Difficulty */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Difficulty for new image</p>
                  <div className="flex gap-1">
                    {([1, 2, 3] as Difficulty[]).map((d) => (
                      <Button
                        key={d}
                        variant={selectedDifficulty === d ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedDifficulty(d)}
                        className="flex-1 h-7 px-2 text-xs"
                      >
                        {DIFFICULTY_LABELS[d]}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* New image */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Start a new {DIFFICULTY_LABELS[selectedDifficulty]} image</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8"
                    onClick={() => setPasswordAction(passwordAction === 'new' ? null : 'new')}
                    disabled={createNewLocation.isPending || isCreatingRound}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isCreatingRound ? "animate-spin" : ""}`} />
                    New Image
                  </Button>
                </div>

                {/* Zoom out */}
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-xs text-muted-foreground">Force next zoom level</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8"
                    onClick={() => setPasswordAction(passwordAction === 'zoom' ? null : 'zoom')}
                  >
                    <ZoomOut className="h-3.5 w-3.5 mr-1.5" />
                    Manual Zoom Out
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>

        {passwordAction && (
          <div className="px-6 pb-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder={passwordAction === 'zoom' ? "Password to zoom out" : `Password to start ${DIFFICULTY_LABELS[selectedDifficulty]} round`}
                value={actionPassword}
                onChange={(e) => { setActionPassword(e.target.value); setActionError(''); }}
                className="flex-1 h-8 text-sm"
              />
              <Button size="sm" onClick={handlePasswordConfirm} className="h-8">
                {passwordAction === 'zoom' ? 'Zoom Out' : 'Start'}
              </Button>
            </div>
            {actionError && <p className="text-xs text-destructive mt-1">{actionError}</p>}
          </div>
        )}

      <CardContent className="space-y-4">
        {remainingGuesses === 0 ? (
          <div className="text-center py-6">
            <Check className="h-12 w-12 text-success mx-auto mb-3" />
            <p className="font-medium">You've used all guesses for this zoom level!</p>
            <p className="text-sm text-muted-foreground">Wait for the next zoom out to get 3 more guesses.</p>
          <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">Your guesses:</p>
              {userGuesses.map((guess, i) => (
                <div key={guess.id} className="text-sm bg-secondary px-3 py-2 rounded-md flex justify-between">
                  <span>Guess #{i + 1}</span>
                  <span className="font-mono text-accent">
                    {formatScoreDisplay(guess.distance_km, calculateScore(guess.distance_km, guess.guess_number, settings))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="w-full h-[320px] overflow-hidden rounded-lg border">
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
            >
              {submitGuess.isPending ? "Submitting..." : "Submit Guess"}
            </Button>
          </>
        )}

        {userGuesses.length > 0 && remainingGuesses > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">Previous guesses:</p>
            <div className="space-y-1">
              {userGuesses.map((guess, i) => (
                <div key={guess.id} className="text-sm bg-secondary/50 px-3 py-1 rounded flex justify-between">
                  <span>#{i + 1}</span>
                  <span className="font-mono">
                    {formatScoreDisplay(guess.distance_km, calculateScore(guess.distance_km, guess.guess_number, settings))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
