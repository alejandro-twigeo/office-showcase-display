import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { useUserGuesses } from "@/hooks/useGuesses";
import { useDeviceId } from "@/hooks/useDeviceId";
import { RefreshCw, MapPin, Target, Check, AlertCircle, Lock, Settings, ZoomIn, ZoomOut, RotateCcw, Binoculars, Brain, Clock, Gamepad2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoundSchedule } from "@/hooks/useRoundSchedule";
import { supabase } from "@/integrations/supabase/client";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/difficulty";
import { fetchMapillaryRound } from "@/lib/mapillary";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useScoring, calculateScore, formatScoreDisplay, type ScoringSettings } from "@/hooks/useScoring";
import { MiniGamesSelector, type MiniGamesSelectorHandle } from "./MiniGamesSelector";
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
  onMinigameChange?: (gameId: string | null) => void;
  hideOtherGames?: boolean;
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

/** Zoomable image with pan + pinch-to-zoom support */
function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);

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

  // Pinch-to-zoom via touch events
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastPinchDist.current !== null) {
          const delta = (dist - lastPinchDist.current) * 0.01;
          setScale(s => Math.min(Math.max(s + delta, 1), 5));
        }
        lastPinchDist.current = dist;
      }
    };
    const onTouchEnd = () => { lastPinchDist.current = null; };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

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

export function GuessMap({ playerName, onActiveTabChange, onMinigameChange, hideOtherGames }: GuessMapProps) {
  const deviceId = useDeviceId();
  const { settings } = useScoring();
  const { activeRound } = useRounds();
  const { schedule, updateSchedule } = useRoundSchedule();
  const creatingRef = useRef(false);
  const [isCreatingRound, setIsCreatingRound] = useState(false);
  const [passwordAction, setPasswordAction] = useState<{ type: 'new' } | null>(null);
  const [actionPassword, setActionPassword] = useState('');
  const [actionError, setActionError] = useState('');
  const miniGameRef = useRef<MiniGamesSelectorHandle>(null);


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




  const [activeTab, setActiveTabInternal] = useState<'easy' | 'hard' | 'other'>('easy');
  const [insideMiniGame, setInsideMiniGame] = useState(false);
  const setActiveTab = (tab: 'easy' | 'hard' | 'other') => {
    setActiveTabInternal(tab);
    onActiveTabChange?.(tab);
  };
  const handleMinigameChange = (gameId: string | null) => {
    setInsideMiniGame(!!gameId);
    onMinigameChange?.(gameId);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {activeTab === 'other' ? 'Other Games' : 'Make Your Guess'}
          </CardTitle>
          <div className="flex items-center gap-1">
            {!hideOtherGames && (
              <Button
                variant={activeTab === 'other' ? 'default' : 'outline'}
                size="sm"
                className={`h-7 text-xs gap-1.5 ${activeTab !== 'other' ? 'border-primary/60 text-primary hover:bg-primary/10 hover:text-primary' : ''}`}
                onClick={() => {
                  if (activeTab === 'other' && insideMiniGame) {
                    miniGameRef.current?.reset();
                  } else if (activeTab === 'other') {
                    setActiveTab('easy');
                  } else {
                    setActiveTab('other');
                    miniGameRef.current?.reset();
                  }
                }}
              >
                <Gamepad2 className="h-3.5 w-3.5" />
                {activeTab === 'other' ? (insideMiniGame ? '← Back to games' : '← Geo Guess') : 'Other Games'}
              </Button>
            )}

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
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {activeTab !== 'other' ? (
          <>
            {/* Geo-Easy / Geo-Hard tabs */}
            <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-lg">
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
            <DifficultyGuessPanel
              key={activeTab}
              difficulty={activeTab === 'easy' ? 1 : 3}
              playerName={playerName}
              settings={settings}
              onCreateRound={() => {}}
              isCreating={isCreatingRound}
            />
          </>
        ) : (
          <MiniGamesSelector ref={miniGameRef} playerName={playerName} onGameChange={handleMinigameChange} roundId={activeRound?.id} />
        )}
      </CardContent>
    </Card>
  );
}
