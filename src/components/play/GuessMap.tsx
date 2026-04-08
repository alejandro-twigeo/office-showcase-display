import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { useUserGuesses } from "@/hooks/useGuesses";
import { useDeviceId } from "@/hooks/useDeviceId";
import { MapPin, Target, Check, AlertCircle, ZoomIn, ZoomOut, RotateCcw, Binoculars, Brain, Gamepad2 } from "lucide-react";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/difficulty";
import { useScoring, calculateScore, formatScoreDisplay, type ScoringSettings } from "@/hooks/useScoring";
import { MiniGamesSelector, type MiniGamesSelectorHandle } from "./MiniGamesSelector";
import { useRounds } from "@/hooks/useRounds";
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
    setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, 0);
    return () => { 
      if (mapRef.current) {
        mapRef.current.remove(); 
        mapRef.current = null; 
      }
    };
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
        className="w-full h-[25vh] lg:h-full overflow-hidden rounded-lg border bg-black touch-none select-none"
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
  const [showLocation, setShowLocation] = useState(false);

  if (!activeLocation) {
    return (
      <div className="text-center py-6">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-2">No active {DIFFICULTY_LABELS[difficulty]} location</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Desktop: image left, map right. Mobile: stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Image */}
        {activeLocation.pano_id && (
          <div className="lg:h-[50vh]">
            <ZoomableImage src={activeLocation.pano_id} alt="mystery" />
          </div>
        )}

        {/* Map */}
        {(canGuess || showLocation) && (
          <div className="h-[22vh] lg:h-[50vh] overflow-hidden rounded-lg border relative">
            <LeafletMap onMapClick={canGuess ? handleMapClick : () => {}} markerPosition={showLocation ? { lat: activeLocation.lat, lng: activeLocation.lng } : selectedPosition} />
            {showLocation && (
              <div className="absolute top-2 left-2 z-[1000] bg-primary text-primary-foreground px-2 py-1 rounded-lg text-xs font-semibold shadow-lg">
                📍 Actual location
              </div>
            )}
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

          <Button
            onClick={handleSubmitGuess}
            disabled={!selectedPosition || submitGuess.isPending}
            className="w-full"
            size="sm"
          >
            {submitGuess.isPending ? "Submitting..." : `Submit Guess${settings.max_guesses_per_challenge != null ? ` (${remainingGuesses} left)` : ''}`}
          </Button>
        </>
      ) : (
        <div className="text-center py-3 space-y-2">
          <Check className="h-8 w-8 text-primary mx-auto" />
          <p className="text-sm font-medium">No more guesses!</p>
          {!showLocation && (
            <Button variant="outline" size="sm" onClick={() => setShowLocation(true)} className="gap-1.5">
              <MapPin className="h-4 w-4" />
              Show Location
            </Button>
          )}
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
  const miniGameRef = useRef<MiniGamesSelectorHandle>(null);




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
              isCreating={false}
            />
          </>
        ) : (
          <MiniGamesSelector ref={miniGameRef} playerName={playerName} onGameChange={handleMinigameChange} roundId={activeRound?.id} />
        )}
      </CardContent>
    </Card>
  );
}
