import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useMinigameTodayScore, useSubmitMinigameScore } from '@/hooks/useMinigameScore';
import { useMinigameSettings } from '@/hooks/useMinigameSettings';
import { fetchMapillaryCity, type MapillaryImage } from '@/lib/mapillary';
import { CheckCircle, MapPin, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'Varna', lat: 43.2141, lng: 27.9147 },
  { name: 'Stockholm', lat: 59.3293, lng: 18.0686 },
];

const GAME_ID = 'city_guess';

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface CityGuessGameProps {
  playerName: string;
  roundId?: string;
}

export function CityGuessGame({ playerName, roundId }: CityGuessGameProps) {
  const deviceId = useDeviceId();
  const settings = useMinigameSettings();
  const { data: todayScore } = useMinigameTodayScore(GAME_ID, playerName, roundId);
  const submitScore = useSubmitMinigameScore();

  const [selectedCity, setSelectedCity] = useState<typeof CITIES[0] | null>(null);
  const [image, setImage] = useState<MapillaryImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [guessPos, setGuessPos] = useState<{ lat: number; lng: number } | null>(null);
  const [guesses, setGuesses] = useState<{ distance: number; score: number }[]>([]);
  const [bestScore, setBestScore] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);

  const MAX_ZOOM = 5;
  const lastPinchDist = useRef<number | null>(null);

  const handleZoomIn = () => setZoom(z => Math.min(z + 1, MAX_ZOOM));
  const handleZoomOut = () => {
    setZoom(z => {
      const nz = Math.max(z - 1, 1);
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });
  };
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  };
  const onPointerUp = () => { setDragging(false); dragStart.current = null; };

  // Pinch-to-zoom
  useEffect(() => {
    const el = imgContainerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastPinchDist.current !== null) {
          const delta = (dist - lastPinchDist.current) * 0.01;
          setZoom(z => Math.min(Math.max(z + delta, 1), MAX_ZOOM));
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
  }, [image]);

  const handleSelectCity = async (city: typeof CITIES[0]) => {
    setSelectedCity(city);
    setLoading(true);
    try {
      const img = await fetchMapillaryCity(city.lat, city.lng);
      setImage(img);
    } catch (e) {
      console.error('Failed to load city image', e);
    } finally {
      setLoading(false);
    }
  };

  // Init leaflet map – must wait until loading is done so the div is mounted
  useEffect(() => {
    if (!mapRef.current || leafletRef.current || !selectedCity || loading) return;
    const map = L.map(mapRef.current).setView([selectedCity.lat, selectedCity.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      setGuessPos({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    leafletRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);
    return () => { map.remove(); leafletRef.current = null; };
  }, [selectedCity, loading]);

  // Update marker
  useEffect(() => {
    if (!leafletRef.current) return;
    if (guessPos) {
      if (markerRef.current) markerRef.current.setLatLng([guessPos.lat, guessPos.lng]);
      else markerRef.current = L.marker([guessPos.lat, guessPos.lng]).addTo(leafletRef.current);
    }
  }, [guessPos]);

  const handleSubmitGuess = useCallback(async () => {
    if (!guessPos || !image || !deviceId) return;
    const dist = calculateDistance(guessPos.lat, guessPos.lng, image.lat, image.lng);
    const attemptIdx = Math.min(guesses.length, settings.city_guess_attempt_multipliers.length - 1);
    const mult = settings.city_guess_attempt_multipliers[attemptIdx] ?? 0.5;
    const points = Math.round((100 / (1 + dist / settings.city_guess_distance_param)) * mult);

    const newGuesses = [...guesses, { distance: dist, score: points }];
    setGuesses(newGuesses);
    setGuessPos(null);

    const newBest = Math.max(bestScore, points);
    setBestScore(newBest);

    // Submit best score
    await submitScore.mutateAsync({
      game_id: GAME_ID,
      player_name: playerName,
      device_id: deviceId,
      score: newBest,
      round_id: roundId,
      meta: { city: selectedCity?.name, attempts: newGuesses.length, best_distance: Math.min(dist, ...(guesses.map(g => g.distance))) },
    });
  }, [guessPos, image, deviceId, guesses, settings, bestScore, playerName, selectedCity, submitScore]);

  if (todayScore) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">🏙️ City Guess</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6 space-y-2">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
          <p className="font-medium">You scored {todayScore.score} pts today!</p>
          <p className="text-xs text-muted-foreground">City: {(todayScore.meta as any)?.city ?? 'Unknown'}</p>
        </CardContent>
      </Card>
    );
  }

  if (!selectedCity) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">🏙️ City Guess</CardTitle>
          <p className="text-xs text-muted-foreground">Pick a city to explore</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {CITIES.map(city => (
              <Button key={city.name} variant="outline" className="justify-start gap-2" onClick={() => handleSelectCity(city)}>
                <MapPin className="h-4 w-4" /> {city.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Loading street view for {selectedCity.name}...</p>
        </CardContent>
      </Card>
    );
  }

  const maxAttempts = settings.city_guess_max_attempts;
  const attemptsLeft = maxAttempts - guesses.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">🏙️ City Guess — {selectedCity.name}</CardTitle>
        <p className="text-xs text-muted-foreground">{attemptsLeft} guess{attemptsLeft !== 1 ? 'es' : ''} left</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {image && (
          <div className="relative">
            <div
              ref={imgContainerRef}
              className="h-[30vh] sm:h-64 rounded-lg overflow-hidden border bg-black cursor-grab active:cursor-grabbing touch-none select-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                src={image.thumb_url}
                alt="mystery location"
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  transformOrigin: 'center center',
                }}
              />
            </div>
            <div className="absolute top-2 right-2 flex gap-1">
              <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full opacity-80" onClick={handleZoomOut} disabled={zoom <= 1}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full opacity-80" onClick={handleReset} disabled={zoom <= 1}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full opacity-80" onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            <span className="absolute top-2 left-2 text-xs bg-secondary/80 px-1.5 py-0.5 rounded font-mono">{zoom}x</span>
          </div>
        )}

        {attemptsLeft > 0 && (
          <>
            <div ref={mapRef} className="h-[28vh] sm:h-56 rounded-lg border z-0" />
            <Button onClick={handleSubmitGuess} disabled={!guessPos || submitScore.isPending} className="w-full" size="sm">
              Submit Guess ({attemptsLeft} left)
            </Button>
          </>
        )}

        {guesses.length > 0 && (
          <div className="space-y-1 border-t pt-2">
            <p className="text-xs text-muted-foreground font-medium">Your guesses:</p>
            {guesses.map((g, i) => (
              <div key={i} className="text-xs bg-secondary/50 px-2 py-1.5 rounded flex justify-between">
                <span>#{i + 1} — {g.distance < 1 ? `${Math.round(g.distance * 1000)} m` : `${Math.round(g.distance)} km`}</span>
                <span className="font-mono font-semibold text-accent">{g.score} pts</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
